const {
	ipcRenderer
} = require('electron');
window.$ = window.jQuery = require('jquery'); // eslint-disable-line no-multi-assign

/* global $:true */
/* global window:true */
/* global document:true */

$(document).ready(() => {
// Keyboard controls for video
	const video = $('#videoPlayer')[0];
	$(window).keydown(event => {
		switch (event.key) {
			case ' ':
				playPause(video);
				break;
			case 'Escape':
				video.pause();
				window.close();
				break;
			default:
		}
	});
	// Top right close button
	$('#videoOverlay').click(() => {
		window.close();
	});
});

ipcRenderer.on('playVideo', (event, data) => {
	if (data !== undefined) {
		$('#videoPlayer').attr('src', `file://${data[0]}`);
		$('#videoPlayer').on('play', () => {
			$('#videoOverlay').fadeTo(1600, 0);
		});
		$('#videoPlayer').on('ended', () => {
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
