const electron = require('electron');

const remote = electron.remote;
const mainProcess = remote.require('./main');

window.$ = window.jQuery = require('jquery');
require('pkginfo')(module, 'version');

/* global $:true */
/* global window:true */
/* global document:true */

$(document).ready(function () {
	mainProcess.menuItems(function (data) {
		for (var i = 0; i < data.length; i++) {
			$('#menu_smartphone ul').append(`<li id="menu_${data[i].id}"><span class="glyphicon glyphicon-${data[i].glyphicon}"></span>&nbsp;${data[i].name}</li>`);
		}
		require('../menu');
	});
	$('.bottom-bar').addClass('bottom-bar-info');
	$('.bottom-bar').html(`Version: ${module.exports.version}`);
});
