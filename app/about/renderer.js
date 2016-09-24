window.$ = window.jQuery = require('jquery');
require('../menu')
require('pkginfo')(module, 'version');

$(document).ready(function() {
    $('.bottom-bar').addClass('bottom-bar-info')
    $('.bottom-bar').html(`Version: ${module.exports.version}`)
});
