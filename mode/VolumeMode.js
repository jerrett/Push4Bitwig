// Written by Jürgen Moßgraber - mossgrabers.de
//            Michael Schmalle - teotigraphix.com
// (c) 2014
// Licensed under GPLv3 - http://www.gnu.org/licenses/gpl.html

VolumeMode.PARAM_NAMES = 'Volume   Volume  Volume   Volume  Volume   Volume  Volume   Volume  ';


function VolumeMode ()
{
	this.id = MODE_VOLUME;
}
VolumeMode.prototype = new BaseMode ();

VolumeMode.prototype.attachTo = function (aPush) 
{
	// Master Track volume value & text
	var v = masterTrack.getVolume ();
	v.addValueObserver (128, function (value)
	{
		master.volume = value;
	});
	v.addValueDisplayObserver (8, '', function (text)
	{
		master.volumeStr = text;
	});
};

VolumeMode.prototype.onValueKnob = function (index, value)
{
	var t = tracks[index];
	t.volume = this.changeValue (value, t.volume);
	trackBank.getTrack (t.index).getVolume ().set (t.volume, 128);
};

VolumeMode.prototype.updateDisplay = function ()
{
	var d = push.display;
	for (var i = 0; i < 8; i++)
	{
		d.setCell (1, i, tracks[i].volumeStr, Display.FORMAT_RAW)
		 .setCell (2, i, tracks[i].volume, Display.FORMAT_VALUE);
	}
	d.setRow (0, VolumeMode.PARAM_NAMES).done (1).done (2);
};