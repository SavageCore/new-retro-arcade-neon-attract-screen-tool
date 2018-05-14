const electron = require('electron');

const {remote} = electron;
const mainProcess = remote.require('./main');

window.$ = window.jQuery = require('jquery'); // eslint-disable-line no-multi-assign
require('pkginfo')(module, 'version');

/* global $:true */
/* global window:true */
/* global document:true */

$(document).ready(() => {
	mainProcess.menuItems(data => {
		for (let i = 0; i < data.length; i++) {
			$('#menu_smartphone ul').append(`<li id="menu_${data[i].id}"><span class="glyphicon glyphicon-${data[i].glyphicon}"></span>&nbsp;${data[i].name}</li>`);
		}
		require('../menu'); // eslint-disable-line  import/no-unassigned-import
	});
	$('.bottom-bar').addClass('bottom-bar-info');
	$('.bottom-bar').html(`Version: ${module.exports.version}`);
});
