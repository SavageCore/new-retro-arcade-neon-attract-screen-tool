const electron = require('electron');

const {remote} = electron;
const mainProcess = remote.require('./main');
window.$ = window.jQuery = require('jquery'); // eslint-disable-line no-multi-assign
const {
	ipcRenderer
} = require('electron');
const moment = require('moment');

/* global $:true */
/* global window:true */

ipcRenderer.on('notificationMsg', (event, data) => {
	const oldContents = $('.bottom-bar').html();
	[data] = data;
	const delay = data.delay || 3000;
	if (data !== undefined) {
		$('.bottom-bar').html(`<div class="">${data.msg}</div>`);
		const timeoutID = window.setTimeout(returnBottomBarState, delay, oldContents, data);

		if (data.open !== undefined) {
			window.clearTimeout(timeoutID);
			$('.bottom-bar').on('click', () => {
				ipcRenderer.send('open-external', data.open);
				$('.bottom-bar').off('click');
				returnBottomBarState(oldContents, data);
			});
		}

		if (data.sticky !== undefined) {
			window.clearTimeout(timeoutID);
		}

		if (data.log !== undefined) {
			const LogWriter = require('log-writer');

			const writer = new LogWriter('error-log-%s.log');
			writer.writeln(`[${moment().format('MMM DD kk:mm:ss')}]`);
			writer.write(data.log);
			writer.write('\n');
			writer.end();
		}

		switch (data.type) {
			case 'error':
				window.clearTimeout(timeoutID);
				$('.bottom-bar').addClass('bottom-bar-error');
				$('.bottom-bar div').attr('title', 'Click to close notification');
				// On click return to default
				$('.bottom-bar').on('click', () => {
					$('.bottom-bar').removeClass(`bottom-bar-${data.type}`);
					$('.bottom-bar').html(oldContents);
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
				});
				break;
			case 'info':
				$('.bottom-bar').addClass('bottom-bar-info');
				break;
			case 'success':
				$('.bottom-bar').addClass('bottom-bar-success');
				break;
			default:
		}
	}
});

function returnBottomBarState(oldContents, data) {
	if (typeof data !== 'undefined') {
		$('.bottom-bar').removeClass(`bottom-bar-${data.type}`);
	}

	$('.bottom-bar').html(oldContents);
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
	/* global timeoutID:true */
	if (typeof timeoutID !== 'undefined') {
		window.clearTimeout(timeoutID);
	}
}

exports.returnBottomBarStateRenderer = returnBottomBarState;
