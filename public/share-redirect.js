// Forwards people from a /s/:id share page into the game. Crawlers don't run JS, so they keep the OG tags.
(function () {
  var link = document.getElementById('play');
  var target = link && link.getAttribute('data-target');
  if (!target) return;
  var url = new URL(target, window.location.href);
  if (url.origin === window.location.origin) window.location.replace(url.href);
})();
