// globals
var VISITOR;
var visitInterval = 10000;
var backgroundStorage = null;
var roomCursors = {};

function visit_rooms() {
  clearTimeout(VISITOR);

  // hack; content script can not access extension localStorage. Get via message passing
  chrome.extension.sendRequest({action: "getLocalStorage"}, function(response) {
    backgroundStorage = response.localStorage;

    var apiToken = backgroundStorage.apiToken;
    if (!apiToken) {
      $('#chrome-campfire').html("No API Token set in extension options");
      return;
    }

    if (!backgroundStorage.isActivated) {
      $('#chrome-campfire').html("Notifications disabled in extension options");
      return;
    }

    var phrases = backgroundStorage.phrases.split(',')
    var phraseRegexes = [];
    for (var i = 0; i < phrases.length; i++) {
      phraseRegexes.push(new RegExp(phrases[i], 'i'));
    }
    
    if (!phraseRegexes) {
      $('#chrome-campfire').html("No phrases set in extensions options");
      return;
    }

    $('a.chat').each(function () {
      var a = $(this);
      var target = a.attr('href');
      var matches = target.match('(https?://)(.*:.*@)?(.*)');
      var authenticated_transcript_url = matches[1] + apiToken + ':X@' + matches[3] + '/transcript.json';

      $.getJSON(
        authenticated_transcript_url,
        function (data) {
          var roomCursor = roomCursors[target];
          if (!roomCursor || !roomCursor.id) roomCursor = {id: 0, lastId: 0};
          roomCursor.lastId = roomCursor.id;

          var numNewMessages = 0;
          for (var i = 0; i < data.messages.length; i++) {
            var message = data.messages[i];
            if (parseInt(message.id) <= parseInt(roomCursor.id)) continue;

            roomCursor.id = parseInt(message.id);
            numNewMessages += 1;

            if (roomCursor.lastId == 0) continue;

            for (var j = 0; j < phraseRegexes.length; j++) {
              if (message.body && message.body.match(phraseRegexes[j])) {
                chrome.extension.sendRequest({action: "notify", title: a.attr('title'), body: message.body.slice(0,50)});
                break;
              }
            }
          }

          roomCursors[target] = roomCursor;
        }
      );
    });

    $('#chrome-campfire').html($('a.chat').length + " rooms pinged at " + (new Date).toString());
    $('#chrome-campfire').css({'background-color': "#ffff00"});
  });

  VISITOR = setTimeout('visit_rooms()', visitInterval);
}

$(document).ready(function () {
  VISITOR = setTimeout('visit_rooms()', visitInterval);
  $('#Sidebar').append('<div id="chrome-campfire-container"><h3>CampfireKit <a href="#">refresh</a></h3>' +
                       '<div id="chrome-campfire"><strong>LOADED PLUGIN</strong></div></div>');

  // attach behavior to refresh link
  $('#chrome-campfire-container h3 a').click(function () {
    visit_rooms();
    return false;
  });
});
