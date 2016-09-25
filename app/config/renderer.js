const electron = require('electron')
const {
    ipcRenderer
} = require('electron')
const remote = electron.remote
const mainProcess = remote.require('./main')
const storage = require('electron-json-storage')
window.$ = window.jQuery = require('jquery');
require('../menu')
require('../notification')

$(document).ready(function() {
    mainProcess.availableEncoders(function(availableEncoders) {
        encodersHTML = ''
        selected = ''
        for (var i in availableEncoders) {
            if (i === '0') selected = " selected"
            encodersHTML += `<option value="${availableEncoders[i].id}"${selected}>${availableEncoders[i].name}</option>`
            selected = ''
        }
        $('#config-encoder').html(encodersHTML)
    });
    mainProcess.parseConfigRenderer('get', 'main', false, function(configData) {
        if (configData.renderScale !== undefined) {
            $('#config-renderScale').val(configData.renderScale)
        }
        if (configData.encoder !== undefined) {
            $("#config-encoder").val(configData.encoder);
        }
        if (configData.hwaccel === true) {
            $('#config-hwaccel').prop('checked', true)
        }
        if (configData.muteAudio === true) {
            $('#config-muteAudio').prop('checked', true)
        }
        if (configData.generateReport === true) {
            $('#config-generateReport').prop('checked', true)
        }
        if (configData.extraCabinets === true) {
            $('#config-extraCabinets').prop('checked', true)
        }
        if (configData.maxDuration !== undefined) {
            if (configData.maxDuration === false) {
                $('#config-maxDuration').val(null)
            } else {
                $('#config-maxDuration').val(configData.maxDuration)
            }
        }

        if (configData.attractScreenPath === undefined) {
            elem = $('.bottom-bar')
            elem.html('Set Attract Screen Path!')
            elem.addClass('bottom-bar-error')
        } else {
            $('#label-attractScreenPath').html('Attract Screen Video - Set')
        }
    });
    $('#config-attractScreenPath').off('click').on('click', function() {
        mainProcess.selectAttractScreenFile();
    });
    $("#config-form").change(function(event) {
        if (event.target.name == 'renderScale') {
            var split = event.target.value.split(':')
                // Calculate greatest common divisor
            var gcd = function(a, b) {
                return (!b) ? a : gcd(b, a % b);
            }
            var videoGCD = gcd(split[0], split[1])
                // Divide width and height by GCD to validate aspect ratio
            if (split[0] / videoGCD === 4 && split[1] / videoGCD === 3) {
                $(`#errorBlock-${event.target.name}`).addClass('hidden')
                $(`#config-${event.target.name}`).parent().removeClass('has-error')
                $(`#config-${event.target.name}`).parent().removeClass('has-feedback')
                mainProcess.updateSettings([event.target.name, event.target.value])
            } else {
                $(`#config-${event.target.name}`).parent().addClass('has-error')
                $(`#config-${event.target.name}`).parent().addClass('has-feedback')
                $(`#errorBlock-${event.target.name}`).html('Invalid render scale ratio - must be 4:3')
                $(`#errorBlock-${event.target.name}`).removeClass('hidden')
            }
        } else if (event.target.type == 'checkbox') {
            mainProcess.updateSettings([event.target.name, event.target.checked])
            if (event.target.name == 'extraCabinets') {
                mainProcess.editConfigINI(event.target.checked)
            }
        } else if (event.target.name == 'maxDuration') {
            if (event.target.value == '0') {
                mainProcess.updateSettings([event.target.name, false])
            } else {
                mainProcess.updateSettings([event.target.name, +event.target.value])
            }
        } else {
            mainProcess.updateSettings([event.target.name, event.target.value])
        }
    });
});

ipcRenderer.on('attractScreenSet', (event, data) => {
    if (data === true) {
        $('#label-attractScreenPath').html('Attract Screen Video - Set')
        elem = $('.bottom-bar')
        elem.html('')
        elem.removeClass('bottom-bar-error')
    }
});
