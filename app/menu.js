const electron = require('electron');

const remote = electron.remote;
const mainProcess = remote.require('./main');

/* global $:true */
/* global document:true */

$(document).ready(function () {
	var isMenuOpen = false;

	$('.menu_btn').click(function () {
		if (isMenuOpen === false) {
			$('#menu_smartphone').clearQueue().animate({
				right: '0px'
			});
			$('#grey_back').fadeIn('fast');

			isMenuOpen = true;
		}
	});
	$('#grey_back').click(function () {
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
});

$('#menu_about').click(function () {
	mainProcess.switchPage('about');
});

$('#menu_main').click(function () {
	mainProcess.switchPage('main');
});

$('#menu_settings').click(function () {
	mainProcess.switchPage('settings');
});

$('#menu_quit').click(function () {
	mainProcess.quitApp();
});
