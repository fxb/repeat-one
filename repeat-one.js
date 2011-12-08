"use strict";

var sp    = getSpotifyApi(1);
var cover = null;

function RepeatOne(canvasId, coverId) {
	var canvasEl = document.getElementById(canvasId),
		context    = canvas.getContext('2d'),
		coverEl    = document.getElementById(coverId),
		margin     = 20,
		width      = 20,
		tipSide    = 30,
		tipHeight  = 50,
		radius     = Math.min(canvasEl.width, canvasEl.height) / 2 - tipSide - margin,
		list       = sp.core.getTemporaryPlaylist('repeat-one'),
		current    = null;

	var _drawArrow = function() {
		context.moveTo(0, 0);
		context.arc(0, 0, radius, Math.PI / 3, 2 * Math.PI);
		context.lineTo(radius + tipSide, 0);
		context.lineTo(radius - width, tipHeight);
		context.lineTo(radius - width * 2 - tipSide, 0);
		context.arc(0, 0, radius - width * 2, 2 * Math.PI, Math.PI / 3, true);
	};

	var _draw = function(hover) {
		context.clearRect(0, 0, canvasEl.width, canvasEl.height);

		// Create a linear gradient
		var gradient = context.createLinearGradient(0, -radius, 0, radius);

		gradient.addColorStop(0, '#86b410');
		gradient.addColorStop(1, '#add740');

		// Draw centered arrow with gradient fill
		{
			context.save();

			context.fillStyle = gradient;

			// Clockwise arrow
			context.beginPath();
			context.translate(canvasEl.width / 2, canvasEl.height / 2);
			_drawArrow();
			context.fill();

			context.restore();
		}

		// Draw inner shadow, using a cut-out shape of the arrow (winding rule)
		{
			context.save();

			context.strokeStyle              = "rgba(0, 0, 0, 0.75)";
			context.shadowBlur               = 5;
			context.shadowColor              = "rgba(0, 0, 0, 1)";
			context.lineWidth                = 2;
			context.globalCompositeOperation = "destination-out";

			context.beginPath();

			// Counter-clockwise rectangle.
			context.moveTo(0, 0);
			context.lineTo(0, canvasEl.height);
			context.lineTo(canvasEl.width, canvasEl.height);
			context.lineTo(canvasEl.width, 0);
			context.lineTo(0, 0);

			// Clockwise arrow.
			context.translate(canvasEl.width / 2, canvasEl.height / 2);
			_drawArrow();
			context.stroke();

			context.restore();
		}

		// Draw outer shadow
		{
			context.save();

			context.shadowBlur               = 50;
			context.shadowColor              = hover ? "rgba(184, 255, 145, 0.3)" : "rgba(184, 255, 145, 0.1)";
			context.globalCompositeOperation = "destination-over";

			// Clockwise arrow.
			context.beginPath();
			context.translate(canvasEl.width / 2, canvasEl.height / 2);
			_drawArrow();
			context.fill();

			context.restore();
		}
	};

	var _animateStop = function() {
		canvasEl.classList.remove('animation-kick');
		canvasEl.classList.remove('animation-rotate');
	};

	var _animate = function() {
		_animateStop();

		canvasEl.style.webkitAnimationPlayState = 'running';

		canvasEl.addEventListener('webkitAnimationEnd', function onAnimationEnd() {
			canvasEl.classList.remove('animation-kick');
			canvasEl.classList.add('animation-rotate');

			canvasEl.removeEventListener('webkitAnimationEnd', onAnimationEnd);
		});

		canvasEl.classList.add('animation-kick');
	};

	var _setCover = function(uri) {
		coverEl.innerText             = '';
		coverEl.style.backgroundImage = 'url(' + uri + ')';
	};

	var _resetCover = function() {
		coverEl.innerText             = 'Drop a track';
		coverEl.style.backgroundImage = '';
	};

	var _repeat = function(uri) {
			current = uri;

			// Clear the temporary list
			while (list.length > 0) {
				list.remove(0);
			}

			// Add uri twice to work around repeat bug
			list.add(uri);
			list.add(uri);

			// Start playling the uri and enable repeat
			sp.trackPlayer.playTrackFromContext(list.uri, 0, uri, {
				onComplete : function() {}
			}, false);
			sp.trackPlayer.setRepeat(true);

			// Load the cover
			sp.core.getMetadata(uri, {
				onSuccess : function(data) {
					_setCover(data.album.cover);
					_animate();
				}
			});
	};

	var _applyUriFromData = function(data, callback) {
		var uris = data.split(/\s+/).filter(function(uri) { return uri.length > 0; });

		// Check if it is a track link
		if (uris.length >= 1 && sp.core.getLinkType(uris[0]) == 4) {
			callback(uris[0].replace('http://open.spotify.com/track/', 'spotify:track:'));
		}
	}

	var _dragHandler = function(e){
		_applyUriFromData(e.dataTransfer.getData('text/plain'), function(uri) {
			_draw(true);
			e.dataTransfer.dropEffect = 'copy';
			e.preventDefault();
		});
	};

	var _dropHandler = function(e){
		_applyUriFromData(e.dataTransfer.getData('text/plain'), function(uri) {
			_repeat(uri);
		});
	};

	var _playerStateChanged = function(e) {
		var currentContext = sp.trackPlayer.getPlayingContext();
		var nowPlaying     = sp.trackPlayer.getNowPlayingTrack();

		// Check if we're still playing or if someone else took over
		if (currentContext[0] == list.uri) {
			if (current == null) {
				current = nowPlaying.track.uri;

				// Load the cover
				sp.core.getMetadata(current, {
					onSuccess : function(data) {
						_setCover(data.album.cover);
						_animate();

						if (sp.trackPlayer.getIsPlaying()) {
							canvasEl.style.webkitAnimationPlayState = 'running';
						}
						else {
							canvasEl.style.webkitAnimationPlayState = 'paused';
						}
					}
				});
			}

			// Force repeat
			if (e.data.repeat && !sp.trackPlayer.getRepeat()) {
				sp.trackPlayer.setRepeat(true);
			}

			// Start / stop animation on play / pause
			if (e.data.playstate) {
				if (sp.trackPlayer.getIsPlaying()) {
					canvasEl.style.webkitAnimationPlayState = 'running';
				}
				else {
					canvasEl.style.webkitAnimationPlayState = 'paused';
				}
			}
		}
		else {
			_animateStop();
			_resetCover();
		}
	};

	this.init = function() {
		// Listen for player state changes
		sp.trackPlayer.addEventListener('playerStateChanged', _playerStateChanged);

		// Add sidebar drop link handler
		sp.core.addEventListener('linksChanged', function() {
			_repeat(sp.core.getLinks()[0]);
		});

		// Add drag & drop listeners
		canvasEl.addEventListener('dragenter', _dragHandler);
		canvasEl.addEventListener('dragover',  _dragHandler);
		canvasEl.addEventListener('dragleave', partial(_draw, false));
		canvasEl.addEventListener('drop',      _dropHandler);

		// Add mouse over / out redraw listeners
		canvasEl.addEventListener('mouseover', partial(_draw, true));
		canvasEl.addEventListener('mouseout',  partial(_draw, false));

		// Reset cover element
		_resetCover();

		// Intitial draw
		_draw(false);
		_playerStateChanged({data:{}});
	};
}

exports.init = function() {
	new RepeatOne('canvas', 'cover').init();
};
