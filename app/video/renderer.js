const {
ipcRenderer
} = require('electron');
window.$ = window.jQuery = require('jquery');

/* global $:true */
/* global window:true */
/* global document:true */

$(document).ready(function () {
// Keyboard controls for video
	var video = $('#videoPlayer')[0];
	$(window).keydown(function (event) {
		switch (event.key) {
			case ' ':
				playPause(video);
				break;
			case 'Escape':
				video.pause();
				window.close();
				break;
			default:
				return;
		}
	});
// Top right close button
	$('#videoOverlay').click(function () {
		window.close();
	});
});

ipcRenderer.on('playVideo', (event, data) => {
	if (data !== undefined) {
		$('#videoPlayer').attr('src', `file://${data[0]}`);
		$('#videoPlayer').on('play', function () {
			$('#videoOverlay').fadeTo(1600, 0);
		});
		$('#videoPlayer').on('ended', function () {
			window.close();
		});
	}
});

function playPause(video) {
	if (video.paused) {
		video.play();
	} else {
		video.pause();
	}
}
