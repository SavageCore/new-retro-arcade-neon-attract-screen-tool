const electron = require('electron');

const {remote} = electron;
const mainProcess = remote.require('./main');
window.$ = window.jQuery = require('jquery'); // eslint-disable-line no-multi-assign
const {
	ipcRenderer
} = require('electron');
const notification = require('./notification');

/* global $:true */
/* global window:true */
/* global document:true */
/* global totalVideos:true */

$(document).ready(async () => {
	const mainConfig = await mainProcess.parseConfigRenderer('get', 'main', false)
		.catch(error => {
			console.error(error);
		});
	if (mainConfig.extraCabinets === true) {
		totalVideos = 35;
	} else {
		totalVideos = 30;
	}

	const menuItems = await mainProcess.menuItems()
		.catch(error => {
			console.error(error);
		});
	for (let i = 0; i < menuItems.length; i++) {
		$('#menu_smartphone ul').append(`<li id="menu_${menuItems[i].id}"><span class="glyphicon glyphicon-${menuItems[i].glyphicon}"></span>&nbsp;${menuItems[i].name}</li>`);
	}

	require('./menu'); // eslint-disable-line  import/no-unassigned-import

	let selectHTML = '';
	for (let i = 1; i < totalVideos + 1; i++) {
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

	$('#attract_screen_render').click(() => {
		$('<div class="block-overlay"></div>').appendTo('body');
		mainProcess.renderVideo();
	});

	$('#attract_screen_delete').click(() => {
		mainProcess.deleteVideo($('#attract_screen').data('gridnum') - 1);
	});
	$('#navbar_page select').change(function () {
		$('#attract_screen').data('gridnum', $(this).val());
		mainProcess.changeGrid($('#attract_screen').data('gridnum') - 1)
			.catch(error => {
				console.error(error);
			});
		$('#navbar_page select option').each(function () {
			if ($(this).val() === $('#attract_screen').data('gridnum')) {
				$(this).prop('selected', true);
			} else {
				$(this).prop('selected', false);
			}
		});
	});
	$('#navbar_prev').click(() => {
		navbarPrevPage();
	});
	$('#navbar_next').click(() => {
		navbarNextPage();
	});

	$(window).keydown(event => {
		switch (event.key) {
			case 'ArrowLeft':
				navbarPrevPage();
				break;
			case 'ArrowRight':
				navbarNextPage();
				break;
			default:
		}
	});
	const rangeSlider = function () {
		const slider = $('.range-slider');
		const range = $('.range-slider__range');
		const	value = $('.range-slider__value');

		slider.each(() => {
			value.each(function () {
				const value = $(this).prev().attr('value');
				$(this).html(value);
			});

			range.on('input', function () {
				$(this).next(value).html(this.value);
				mainProcess.attractVolume($('#attract_screen').data('gridnum') - 1, this.value);
			});
		});
	};

	rangeSlider();
});

$('#details').click(() => {
	mainProcess.playVideo($('#attract_screen').data('gridnum') - 1);
});

ipcRenderer.on('thumbnailImage', (event, data) => {
	document.querySelector('#attract_screen_img').src = `${data[0]}?${new Date().getTime()}`;
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
		let htmlContent;
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

	if (data[5] !== undefined && data[5] !== null) {
		$('.range-slider__value').html(data[5]);
		$('.range-slider__range').val(data[5]);
	} else {
		$('.range-slider__value').html('1');
		$('.range-slider__range').val('1');
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
	let x = Number($('#attract_screen').data('gridnum'));
	let prevGrid = --x;
	if (prevGrid < 1) {
		prevGrid = totalVideos;
	}

	$('#attract_screen').data('gridnum', prevGrid);
	mainProcess.changeGrid(prevGrid - 1)
		.catch(error => {
			console.error(error);
		});
	$('#navbar_page select option').each(function () {
		if (Number($(this).val()) === Number($('#attract_screen').data('gridnum'))) {
			$(this).prop('selected', true);
		} else {
			$(this).prop('selected', false);
		}
	});
}

function navbarNextPage() {
	let x = Number($('#attract_screen').data('gridnum'));
	let nextGrid = ++x;
	if (nextGrid > totalVideos) {
		nextGrid = 1;
	}

	$('#attract_screen').data('gridnum', nextGrid);
	mainProcess.changeGrid(nextGrid - 1)
		.catch(error => {
			console.error(error);
			return false;
		});
	$('#navbar_page select option').each(function () {
		if (Number($(this).val()) === Number($('#attract_screen').data('gridnum'))) {
			$(this).prop('selected', true);
		} else {
			$(this).prop('selected', false);
		}
	});
}
