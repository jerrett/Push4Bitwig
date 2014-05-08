// Written by Jürgen Moßgraber - mossgrabers.de
// Contributions by Michael Schmalle - teotigraphix.com
// (c) 2014
// Licensed under GPLv3 - http://www.gnu.org/licenses/gpl.html

function BaseView ()
{
	this.canScrollLeft = true;
	this.canScrollRight = true;
	this.canScrollUp = true;
	this.canScrollDown = true;

	this.stopPressed = false;
	this.newPressed = false;
	
	this.ttLastMillis = -1;
	this.ttLastBPM = -1;
	this.ttHistory = [];
}
BaseView.prototype = new View ();
BaseView.prototype.constructor = BaseView;

BaseView.lastNoteView = VIEW_PLAY;

BaseView.prototype.onActivate = function ()
{
	this.updateNoteMapping ();
	this.updateArrows ();
	setMode (currentMode);
};

BaseView.prototype.updateNoteMapping = function ()
{
	noteInput.setKeyTranslationTable (initArray (-1, 128));
};

BaseView.prototype.updateArrows = function ()
{
	push.setButton (PUSH_BUTTON_LEFT, this.canScrollLeft ? PUSH_BUTTON_STATE_HI : PUSH_BUTTON_STATE_OFF);
	push.setButton (PUSH_BUTTON_RIGHT, this.canScrollRight ? PUSH_BUTTON_STATE_HI : PUSH_BUTTON_STATE_OFF);
	push.setButton (PUSH_BUTTON_UP, this.canScrollUp ? PUSH_BUTTON_STATE_HI : PUSH_BUTTON_STATE_OFF);
	push.setButton (PUSH_BUTTON_DOWN, this.canScrollDown ? PUSH_BUTTON_STATE_HI : PUSH_BUTTON_STATE_OFF);
};

BaseView.prototype.onPlay = function ()
{
	if (this.push.isShiftPressed ())
		transport.toggleLoop ();
	else
		transport.play ();
};

BaseView.prototype.onRecord = function ()
{
	if (this.push.isShiftPressed ())
		transport.toggleLauncherOverdub ();
	else
		transport.record ();
};

BaseView.prototype.onStop = function (buttonState)
{
	if (this.push.isShiftPressed ())
	{
		trackBank.getClipLauncherScenes ().stop ();
		return;
	}
	this.stopPressed = buttonState == BUTTON_STATE_DOWN;
	push.setButton (PUSH_BUTTON_STOP, this.stopPressed ? PUSH_BUTTON_STATE_HI : PUSH_BUTTON_STATE_ON);
};

BaseView.prototype.onDuplicate = function ()
{
	// TODO Not possible?
	host.showPopupNotification ("Duplicate: Function not supported (yet).");
};

BaseView.prototype.onAutomation = function ()
{
	var selectedTrack = getSelectedTrack ();
	if (selectedTrack != null)
		transport.toggleWriteArrangerAutomation ();
};

BaseView.prototype.onFixedLength = function (isDown)
{
	setMode (isDown ? MODE_FIXED : previousMode);
};

BaseView.prototype.onQuantize = function ()
{
	// TODO Not possible?
	host.showPopupNotification ("Quantize: Function not supported (yet).");
};

BaseView.prototype.onDouble = function ()
{
	application.duplicate ();
};

BaseView.prototype.onDelete = function ()
{
	// Weird workaround as 'delete' is a reserved word in JS
	var deleteFunction = application['delete'];
	deleteFunction.call (application);
};

BaseView.prototype.onUndo = function ()
{
	if (this.push.isShiftPressed ())
		application.redo ();
	else
		application.undo ();
};

// Set tempo
BaseView.prototype.onSmallKnob1 = function (increase)
{
	tempo = increase ? Math.min (tempo + 1, TEMPO_RESOLUTION) : Math.max (0, tempo - 1);
	transport.getTempo ().set (tempo, TEMPO_RESOLUTION);
};

BaseView.prototype.onSmallKnob1Touch = function (isTouched)
{
	transport.getTempo ().setIndication (isTouched);
};

// Change time (play position)
BaseView.prototype.onSmallKnob2 = function (increase)
{
	var frac = this.push.isShiftPressed () ? INC_FRACTION_TIME_SLOW : INC_FRACTION_TIME;
	transport.incPosition (delta = increase ? frac : -frac, false);			
};

BaseView.prototype.onClick = function ()
{
	transport.toggleClick ();
};

BaseView.prototype.onTapTempo = function ()
{
	var millis = new Date ().getTime ();
	
	// First press?
	if (this.ttLastMillis == -1)
	{
		this.ttLastMillis = millis;
		return;
	}	
	
	// Calc the difference
	var diff = millis - this.ttLastMillis;
	this.ttLastMillis = millis;
	
	// Store up to 8 differences for average calculation
	this.ttHistory.push (diff);
	if (this.ttHistory.length > 8)
		this.ttHistory.shift ();

	// Calculate the new average difference
	var sum = 0;
	for (var i = 0; i < this.ttHistory.length; i++)
		sum += this.ttHistory[i];
	var average = sum / this.ttHistory.length;
	var bpm = 60000 / average;
	
	// If the deviation is greater 20bpm, reset history
	if (this.ttLastBPM != -1 && Math.abs (this.ttLastBPM - bpm) > 20)
	{
		this.ttHistory.length = 0;
		this.ttLastBPM = -1;
	}
	else
	{
		this.ttLastBPM = bpm;
		// Rescale to Bitwig
		var scaled = (bpm - 20) / 646 * TEMPO_RESOLUTION;
		transport.getTempo ().set (Math.min (Math.max (0, scaled), TEMPO_RESOLUTION), TEMPO_RESOLUTION);
	}
};

BaseView.prototype.onValueKnob = function (index, value)
{
	var m = push.getActiveMode ();
	if (m != null)
		m.onValueKnob (index, value);
};

BaseView.prototype.onValueKnobTouch = function (index, isTouched)
{
	var m = push.getActiveMode ();
	if (m != null)
		m.onValueKnobTouch (index, isTouched);
	
	// See https://github.com/git-moss/Push4Bitwig/issues/32
	// We keep the code if an additional focus becomes available
	/*
	switch (currentMode)
	{
		case MODE_MASTER:
			if (index == 0)
			{
				// Volume
				masterTrack.getVolume ().setIndication (isTouched);
			}
			else if (index == 1)
			{
				// Pan
				masterTrack.getPan ().setIndication (isTouched);
			}
			break;
	
		case MODE_TRACK:
			var selectedTrack = getSelectedTrack ();
			if (selectedTrack == null)
				return;
				
			var t = trackBank.getTrack (selectedTrack.index);
			if (index == 0)
			{
				// Volume
				t.getVolume ().setIndication (isTouched);
			}
			else if (index == 1)
			{
				// Pan
				t.getPan ().setIndication (isTouched);
			}
			else
			{
				// Send 1-6 Volume
				var sel = index - 2;
				var send = selectedTrack.sends[sel];
				t.getSend (send.index).setIndication (isTouched);
			}
			break;
		
		case MODE_VOLUME:
			var t = tracks[index];
			trackBank.getTrack (t.index).getVolume ().setIndication (isTouched);
			break;
			
		case MODE_PAN:
			var t = tracks[index];
			trackBank.getTrack (t.index).getPan ().setIndication (isTouched);
			break;
			
		case MODE_SEND1:
		case MODE_SEND2:
		case MODE_SEND3:
		case MODE_SEND4:
		case MODE_SEND5:
		case MODE_SEND6:
			var sendNo = currentMode - MODE_SEND1;
			var t = tracks[index];
			var send = t.sends[sendNo];
			trackBank.getTrack (t.index).getSend (sendNo).setIndication (isTouched);
			break;
		
		case MODE_DEVICE:
			device.getParameter (index).setIndication (isTouched);
			break;
			
		case MODE_SCALES:
			// Not used
			break;
	}
	*/
};

// Master Volume
BaseView.prototype.onValueKnob9 = function (value)
{
	masterTrack.getVolume ().inc (value <= 61 ? 1 : -1, 128);
};

BaseView.prototype.onValueKnob9Touch = function (isTouched)
{
	if (currentMode != MODE_MASTER)
		masterTrack.getVolume ().setIndication (isTouched);
};

BaseView.prototype.onFirstRow = function (index)
{
	var m = push.getActiveMode ();
	if (m != null)
		m.onFirstRow (index);
	
	// TODO (mschmalle) This only seems right if we have a contract with
	// Push that 'Not In Full Display' means we will always have track toggles
	// for the first row, is the correct?
	if (!push.isFullDisplayMode(currentMode)) 
	{
		if (this.stopPressed)
			trackBank.getTrack (index).stop ();
		else
			trackBank.getTrack (index).select ();
	}
};

// Rec arm / enable monitor buttons
BaseView.prototype.onSecondRow = function (index)
{
	var m = push.getActiveMode ();
	if (m != null)
		m.onSecondRow (index);
	
	// TODO (mschmalle) Can we do this better now that we have more abstraction with modes?
	if (currentMode != MODE_DEVICE && currentMode != MODE_MASTER)
	{
		var t = trackBank.getTrack (index);
		if (this.push.isShiftPressed ())
			; // TODO Toggle monitor; Possible?
		else
			 t.getArm ().set (toggleValue (tracks[index].recarm));
	} 
};

BaseView.prototype.onMaster = function (buttonState)
{
	switch (buttonState)
	{
		case BUTTON_STATE_UP:
			if (currentMode == MODE_FRAME)
				setMode (previousMode);
			break;
		case BUTTON_STATE_DOWN:
			setMode (MODE_MASTER);
			masterTrack.select ();
			break;
		case BUTTON_STATE_LONG:
			setMode (MODE_FRAME);
			break;
	}
};

BaseView.prototype.onVolume = function ()
{
	setMode (MODE_VOLUME);
};

BaseView.prototype.onPanAndSend = function ()
{
	var mode = currentMode + 1;
	if (mode < MODE_PAN || mode > MODE_SEND6)
		mode = MODE_PAN;
	setMode (mode);
};

BaseView.prototype.onTrack = function ()
{
	setMode (MODE_TRACK);
};

BaseView.prototype.onDevice = function ()
{
	if (currentMode == MODE_DEVICE)
		setMode (MODE_MACRO);
	else
		setMode (MODE_DEVICE);
};

BaseView.prototype.onBrowse = function ()
{
	if (currentMode == MODE_DEVICE)
		setMode(MODE_PRESET);
	else
		application.toggleBrowserVisibility (); // Track
};

// Dec Track or Device Parameter Bank
BaseView.prototype.onDeviceLeft = function ()
{
	if (currentMode == MODE_DEVICE)
	{
		device.previousParameterPage ();
		return;
	}
	if (canScrollTrackUp)
	{
		trackBank.scrollTracksPageUp ();
		host.scheduleTask (selectTrack, [7], 100);
	}
};

// Inc Track or Device Parameter Bank
BaseView.prototype.onDeviceRight = function ()
{
	if (currentMode == MODE_DEVICE)
	{
		device.nextParameterPage ();
		return;
	}
	if (canScrollTrackDown)
	{
		trackBank.scrollTracksPageDown ();
		host.scheduleTask (selectTrack, [0], 100);
	}
};

BaseView.prototype.onMute = function ()
{
	var selectedTrack = getSelectedTrack ();
	if (selectedTrack == null)
		return;
	selectedTrack.mute = toggleValue (selectedTrack.mute);
	trackBank.getTrack (selectedTrack.index).getMute ().set (selectedTrack.mute);
	push.setButton (PUSH_BUTTON_MUTE, selectedTrack.mute ? PUSH_BUTTON_STATE_HI : PUSH_BUTTON_STATE_ON);
};

BaseView.prototype.onSolo = function ()
{
	var selectedTrack = getSelectedTrack ();
	if (selectedTrack == null)
		return;
	selectedTrack.solo = toggleValue (selectedTrack.solo);
	trackBank.getTrack (selectedTrack.index).getSolo ().set (selectedTrack.solo);
	push.setButton (PUSH_BUTTON_SOLO, selectedTrack.solo ? PUSH_BUTTON_STATE_HI : PUSH_BUTTON_STATE_ON);
};

BaseView.prototype.onScales = function (isDown)
{
	setMode (isDown ? MODE_SCALES : previousMode);
};

BaseView.prototype.onOctaveDown = function ()
{
	currentOctave = Math.max (-3, currentOctave - 1);
	this.updateNoteMapping ();
};

BaseView.prototype.onOctaveUp = function ()
{
	currentOctave = Math.min (3, currentOctave + 1);
	this.updateNoteMapping ();
};

BaseView.prototype.onAddFX = function ()
{
	// TODO Not possible?
	host.showPopupNotification ("Add Effect: Function not supported (yet).");
};

BaseView.prototype.onAddTrack = function ()
{
	// TODO Not possible?
	host.showPopupNotification ("Add Track: Function not supported (yet).");
};

BaseView.prototype.onNote = function ()
{
	BaseView.lastNoteView = this.push.isActiveView (VIEW_SESSION) ? BaseView.lastNoteView :
								(this.push.isShiftPressed () ? VIEW_DRUM : (this.push.isActiveView (VIEW_PLAY) ? VIEW_SEQUENCER : VIEW_PLAY));
	this.push.setActiveView (BaseView.lastNoteView);
};

BaseView.prototype.onSession = function ()
{
	if (this.push.isActiveView (VIEW_SESSION))
		return;
	BaseView.lastNoteView = this.push.isActiveView (VIEW_PLAY) ? VIEW_PLAY : (this.push.isActiveView (VIEW_DRUM) ? VIEW_DRUM : VIEW_SEQUENCER);
	this.push.setActiveView (VIEW_SESSION);
};

function selectTrack (index)
{
	var t = trackBank.getTrack (index);
	if (t != null)
		t.select ();
}