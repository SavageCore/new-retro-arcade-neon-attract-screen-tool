const electron = require('electron');

const {remote} = electron;
const mainProcess = remote.require('./main');

/* global $:true */
/* global document:true */

$(document).ready(() => {
	let isMenuOpen = false;

	$('.menu_btn').click(() => {
		if (isMenuOpen === false) {
			$('#menu_smartphone').clearQueue().animate({
				right: '0px'
			});
			$('#grey_back').fadeIn('fast');

			isMenuOpen = true;
		}
	});
	$('#grey_back').click(() => {
		if (isMenuOpen === true) {
			$('#menu_smartphone').clearQueue().animate({
				right: '-570px'
			});
			$('#page').clearQueue().animate({
				'margin-left': '0px'
			});
			$('#grey_back').fadeOut('fast');

			isMenuOpen = false;
		}
	});
	$('#menu_about').click(() => {
		mainProcess.switchPage('about');
	});

	$('#menu_main').click(() => {
		mainProcess.switchPage('main');
	});

	$('#menu_reorder').click(() => {
		mainProcess.switchPage('reorder');
	});

	$('#menu_save').click(() => {
		mainProcess.updateXML();
	});

	$('#menu_settings').click(() => {
		mainProcess.switchPage('settings');
	});

	$('#menu_quit').click(() => {
		mainProcess.quitApp();
	});
});
