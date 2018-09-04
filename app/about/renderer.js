const electron = require('electron');

const {remote} = electron;
const mainProcess = remote.require('./main');

window.$ = window.jQuery = require('jquery'); // eslint-disable-line no-multi-assign
require('pkginfo')(module, 'version');

/* global $:true */
/* global window:true */
/* global document:true */

$(document).ready(async () => {
	const menuItems = await mainProcess.menuItems()
		.catch(error => {
			console.error(error);
		});
	for (let i = 0; i < menuItems.length; i++) {
		$('#menu_smartphone ul').append(`<li id="menu_${menuItems[i].id}"><span class="glyphicon glyphicon-${menuItems[i].glyphicon}"></span>&nbsp;${menuItems[i].name}</li>`);
	}
	require('../menu'); // eslint-disable-line  import/no-unassigned-import
	$('.bottom-bar').addClass('bottom-bar-info');
	$('.bottom-bar').html(`Version: ${module.exports.version}`);
});
