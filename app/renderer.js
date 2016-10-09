const electron = require('electron');

const remote = electron.remote;
const mainProcess = remote.require('./main');
window.$ = window.jQuery = require('jquery');
const {
	ipcRenderer
} = require('electron');
require('./menu');
const notification = require('./notification');

/* global $:true */
/* global window:true */
/* global document:true */
/* global totalVideos:true */

mainProcess.parseConfigRenderer('get', 'main', false, function (mainConfig) {
	if (mainConfig.extraCabinets === true) {
		totalVideos = 35;
	} else {
		totalVideos = 30;
	}
});

$(document).ready(function () {
	var selectHTML = '';
	for (var i = 1; i < totalVideos + 1; i++) {
		if (i === 1) {
			selectHTML += `<option selected>${i}</option>`;
		} else {
			selectHTML += `<option>${i}</option>`;
		}
	}
	$('#navbar_page select').html(selectHTML);

	$('#attract_screen').click(function () {
		mainProcess.selectVideoFile($(this).data('gridnum') - 1);
	});

	$('#attract_screen_default').click(function () {
// If video not assigned to grid return
		if ($('#attract_screen_img').attr('src').indexOf('media\\blank') >= 0) {
			return;
		}
		if ($(this).attr('class').indexOf('highlight-color') >= 0) {
			mainProcess.unsetDefaultVideo($('#attract_screen').data('gridnum') - 1);
		} else {
			mainProcess.defaultVideo($('#attract_screen').data('gridnum') - 1);
		}
	});

	$('#attract_screen_render').click(function () {
		$('<div class="block-overlay"></div>').appendTo('body');
		mainProcess.renderVideo();
	});

	$('#attract_screen_delete').click(function () {
		mainProcess.deleteVideo($('#attract_screen').data('gridnum') - 1);
	});
	$('#navbar_page select').change(function () {
		$('#attract_screen').data('gridnum', $(this).val());
		mainProcess.changeGrid($('#attract_screen').data('gridnum') - 1);
		$('#navbar_page select option').each(function () {
			if ($(this).val() === $('#attract_screen').data('gridnum')) {
				$(this).prop('selected', true);
			} else {
				$(this).prop('selected', false);
			}
		});
	});
	$('#navbar_prev').click(function () {
		navbarPrevPage();
	});
	$('#navbar_next').click(function () {
		navbarNextPage();
	});

	$(window).keydown(function (event) {
		switch (event.key) {
			case 'ArrowLeft':
				navbarPrevPage();
				break;
			case 'ArrowRight':
				navbarNextPage();
				break;
			default:
				return;
		}
	});
});

$('#details').click(function () {
	mainProcess.playVideo($('#attract_screen').data('gridnum') - 1);
});

ipcRenderer.on('thumbnailImage', (event, data) => {
	document.getElementById(`attract_screen_img`).src = `${data[0]}?${new Date().getTime()}`;
});

ipcRenderer.on('defaultVideo', (event, data) => {
	if (data === $('#attract_screen').data('gridnum') - 1) {
		$('#attract_screen_default').removeClass('glyphicon-star-empty');
		$('#attract_screen_default').addClass('glyphicon-star');
		$('#attract_screen_default').addClass('highlight-color');
	} else {
		$('#attract_screen_default').removeClass('highlight-color');
		$('#attract_screen_default').removeClass('glyphicon-star');
		$('#attract_screen_default').addClass('glyphicon-star-empty');
	}
});

ipcRenderer.on('screenStatus', (event, data) => {
	if (data === false) {
		$('#screenStatus').addClass('hidden');
	} else if (data !== undefined) {
		$('#screenStatus').html(data);
		$('#screenStatus').removeClass('hidden');
	}
});

ipcRenderer.on('gridDetails', (event, data) => {
	if (data[0] !== false) {
		var htmlContent;
		htmlContent = `<p>File ${data[4]}</p>`;
		htmlContent += `<p>Length ${Math.floor(data[1])} seconds</p>`;
		htmlContent += `<p>Width ${data[2]}</p>`;
		htmlContent += `<p>Height ${data[3]}</p>`;
		$('#details').html(htmlContent);
	} else if (data[0] === false && data[1] !== undefined) {
		$('#details').html(`<p>${data[1]}</p>`);
	} else {
		$('#details').html();
	}
});

ipcRenderer.on('render', (event, data) => {
	if (data[1] === true) {
		$('.block-overlay').remove();
		return;
	}
	switch (data[0]) {
		case 'start':
			oldContents = $('.bottom-bar').html(); // eslint-disable-line no-undef
			$('.bottom-bar').addClass('bottom-bar-progress');
			$('.bottom-bar').html(`
				<div class="progress-bar progress-bar-success progress-bar-striped" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" style="width: 0%"></div>
				<span class="sr-only"></span>`
			);
			ipcRenderer.on('renderProgress', (event, data) => {
				if (data !== undefined) {
					$('.bottom-bar .progress-bar').css('width', `${data[1] * 100}%`);
					$('.bottom-bar .progress-bar').attr('aria-valuenow', data[1]);
					$('.bottom-bar > span').html(`${Math.floor(data[1] * 100)}% Complete`);
				}
			});
			break;
		case 'end':
			notification.returnBottomBarStateRenderer(oldContents, 'progress'); // eslint-disable-line no-undef
			$('.block-overlay').remove();
			break;
		default:
			break;
	}
});

function navbarPrevPage() {
	var x = Number($('#attract_screen').data('gridnum'));
	var prevGrid = --x;
	if (prevGrid < 1) {
		prevGrid = totalVideos;
	}
	$('#attract_screen').data('gridnum', prevGrid);
	mainProcess.changeGrid(prevGrid - 1);
	$('#navbar_page select option').each(function () {
		if (Number($(this).val()) === Number($('#attract_screen').data('gridnum'))) {
			$(this).prop('selected', true);
		} else {
			$(this).prop('selected', false);
		}
	});
}

function navbarNextPage() {
	var x = Number($('#attract_screen').data('gridnum'));
	var nextGrid = ++x;
	if (nextGrid > totalVideos) {
		nextGrid = 1;
	}
	$('#attract_screen').data('gridnum', nextGrid);
	mainProcess.changeGrid(nextGrid - 1);
	$('#navbar_page select option').each(function () {
		if (Number($(this).val()) === Number($('#attract_screen').data('gridnum'))) {
			$(this).prop('selected', true);
		} else {
			$(this).prop('selected', false);
		}
	});
}
