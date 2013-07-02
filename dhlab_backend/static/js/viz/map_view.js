// Generated by CoffeeScript 1.6.1
var __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

define(['jquery', 'vendor/underscore', 'vendor/backbone-min', 'leaflet', 'leaflet_heatmap', 'leaflet_cluster'], function($, _, Backbone, L) {
  var MapView;
  MapView = (function(_super) {

    __extends(MapView, _super);

    function MapView() {
      return MapView.__super__.constructor.apply(this, arguments);
    }

    MapView.prototype.name = "MapView";

    MapView.prototype.el = $('#map_viz');

    MapView.prototype.btn = $('#map_btn');

    MapView.prototype.map_headers = [];

    MapView.prototype.selected_header = void 0;

    MapView.prototype.map = void 0;

    MapView.prototype.controls = void 0;

    MapView.prototype.playback = void 0;

    MapView.prototype.start_date = $('#start_date');

    MapView.prototype.end_date = $('#end_date');

    MapView.prototype.step_current = 0;

    MapView.prototype.num_steps = 0;

    MapView.prototype.quantum = 0;

    MapView.prototype.is_paused = true;

    MapView.prototype.progress = 0;

    DataView.prototype.pL = [];

    DataView.prototype.pLStyle = {
      color: "blue",
      weight: 0.5,
      opacity: 1,
      smoothFactor: 0.5
    };

    MapView.prototype.events = {
      "click #pause": "pause_playback",
      "click #reset": "reset_playback",
      "click #time_c": "time_c",
      "click #clear": "clear_lines"
    };

    MapView.prototype.initialize = function(options) {
      var day, month, now;
      this.parent = options.parent;
      this.data = options.data;
      this.form = options.form;
      this._detect_headers(this.form.attributes.children);
      this.mapIcon = L.icon({
        iconUrl: '//keep-static.s3.amazonaws.com/img/leaflet/marker-icon.png',
        iconRetinaUrl: '//keep-static.s3.amazonaws.com/img/leaflet/marker-icon@2x.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowUrl: '//keep-static.s3.amazonaws.com/img/leaflet/marker-shadow.png',
        shadowSize: [41, 41],
        shadowAnchor: [15, 41]
      });
      if (this.map_headers.length > 0) {
        this.btn.removeClass('disabled');
        this.render();
        if (this.start_date.val().length > 0) {
          this.min_time = Date.parse(this.start_date.val());
        } else {
          this.min_time = Date.parse(this.data.models[0].get('timestamp'));
          now = new Date(this.min_time);
          day = ('0' + now.getDate()).slice(-2);
          month = ('0' + (now.getMonth() + 1)).slice(-2);
          this.start_date.val(now.getFullYear() + '-' + month + '-' + day);
        }
        if (this.end_date.val().length > 0) {
          this.max_time = Date.parse(this.end_date.val());
        } else {
          this.max_time = Date.parse(this.data.models[this.data.models.length - 1].get('timestamp'));
          now = new Date(this.max_time);
          day = ('0' + now.getDate()).slice(-2);
          month = ('0' + (now.getMonth() + 1)).slice(-2);
          this.end_date.val(now.getFullYear() + '-' + month + '-' + day);
        }
        this.num_steps = $('#fps').val() * $('#playtime').val();
        this.quantum = Math.floor((this.max_time - this.min_time) / this.num_steps);
        this.lower_bound = this.min_time;
        return this.upper_bound = this.min_time + this.quantum;
      }
    };

    MapView.prototype._detect_headers = function(root) {
      var field, _i, _j, _len, _len1, _ref, _ref1, _ref2, _results;
      for (_i = 0, _len = root.length; _i < _len; _i++) {
        field = root[_i];
        if ((_ref = field.type) === 'group') {
          this._detect_headers(field.children);
        }
        if ((_ref1 = field.type) === 'geopoint') {
          this.map_headers.push(field);
          if (this.selected_header == null) {
            this.selected_header = {
              location: field
            };
          }
          continue;
        } else if (field.label.search('lat') !== -1) {
          this.map_headers.push(field);
        } else if (field.label.search('lng') !== -1) {
          this.map_headers.push(field);
        }
      }
      if (this.selected_header == null) {
        this.selected_header = {};
        _ref2 = this.map_headers;
        _results = [];
        for (_j = 0, _len1 = _ref2.length; _j < _len1; _j++) {
          field = _ref2[_j];
          if (field.label.search('lat') !== -1) {
            _results.push(this.selected_header.lat = field);
          } else if (field.label.search('lng') !== -1) {
            _results.push(this.selected_header.lng = field);
          } else {
            _results.push(void 0);
          }
        }
        return _results;
      }
    };

    MapView.prototype._geopoint = function(datum) {
      var geopoint;
      geopoint = void 0;
      if (this.selected_header.location != null) {
        geopoint = datum.get('data')[this.selected_header.location.name];
        if (geopoint == null) {
          return null;
        }
        geopoint = geopoint.split(' ').slice(0, 3);
        if (isNaN(geopoint[0]) || isNaN(geopoint[1])) {
          return null;
        }
      } else {
        geopoint = [datum.get('data')[this.selected_header.lat.name], datum.get('data')[this.selected_header.lng.name]];
      }
      geopoint[0] = parseFloat(geopoint[0]);
      geopoint[1] = parseFloat(geopoint[1]);
      if (isNaN(geopoint[0]) || isNaN(geopoint[1])) {
        return null;
      }
      return geopoint;
    };

    MapView.prototype.render = function() {
      var center, datum, day, geopoint, heatmapData, heatmap_value, html, key, last_marker, layers, marker, pline, valid_count, value, _i, _j, _len, _len1, _ref, _ref1, _ref2;
      center = [0, 0];
      valid_count = 0;
      _ref = this.data.models;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        datum = _ref[_i];
        geopoint = this._geopoint(datum);
        if (geopoint == null) {
          continue;
        }
        center[0] += geopoint[0];
        center[1] += geopoint[1];
        valid_count += 1;
      }
      if (valid_count === 0) {
        this.map_enabled = false;
        $('#map_btn').addClass('disabled');
        $('#map').hide();
        return this;
      }
      center[0] = center[0] / valid_count;
      center[1] = center[1] / valid_count;
      this.map = L.map('map').setView(center, 10);
      L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18
      }).addTo(this.map);
      this.heatmap = L.TileLayer.heatMap({
        radius: 42,
        opacity: 0.8
      });
      heatmap_value = 1.0 / this.data.models.length;
      heatmapData = [];
      this.markers = new L.layerGroup();
      this.clusters = new L.MarkerClusterGroup();
      this.connections = new L.layerGroup();
      last_marker = void 0;
      _ref1 = this.data.models;
      for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
        datum = _ref1[_j];
        geopoint = this._geopoint(datum);
        if (geopoint == null) {
          continue;
        }
        marker = L.marker([geopoint[0], geopoint[1]], {
          icon: this.mapIcon
        });
        marker.data = datum.get('data');
        marker.timestamp = new Date(datum.get('timestamp'));
        if (last_marker != null) {
          day = 1000 * 60 * 60 * 24;
          if (marker.timestamp.getTime() - last_marker.timestamp.getTime() < day) {
            pline = [marker.getLatLng(), last_marker.getLatLng()];
            this.connections.addLayer(L.polyline(pline));
          }
          last_marker = marker;
        } else {
          last_marker = marker;
        }
        html = '';
        _ref2 = marker.data;
        for (key in _ref2) {
          value = _ref2[key];
          html += "<div><strong>" + key + ":</strong> " + value + "</div>";
        }
        marker.bindPopup(html);
        this.markers.addLayer(marker);
        this.clusters.addLayer(marker);
        heatmapData.push({
          lat: geopoint[0],
          lon: geopoint[1],
          count: heatmap_value
        });
      }
      this.heatmap.addData(heatmapData);
      this.map.addLayer(this.heatmap);
      layers = {
        'Clusters': this.clusters,
        'Connections': this.connections,
        'Heatmap': this.heatmap,
        'Markers': this.markers
      };
      this.controls = L.control.layers(null, layers, {
        collapsed: false
      });
      this.controls.addTo(this.map);
      return this;
    };

    MapView.prototype.pause_playback = function(event) {
      var auto,
        _this = this;
      if (this.is_paused) {
        $('#pause').html("<i class='icon-pause'></i>");
        this.is_paused = false;
        if (this.playback == null) {
          auto = function() {
            if (!_this.is_paused) {
              return _this.time_step();
            }
          };
          return this.playback = setInterval(auto, 1000.0 / $('#fps').val());
        }
      } else {
        $('#pause').html("<i class='icon-play'></i>");
        return this.is_paused = true;
      }
    };

    MapView.prototype.reset_playback = function(event) {
      if (this.playback != null) {
        clearInterval(this.playback);
        this.playback = null;
      }
      this.lower_bound = this.min_time;
      this.upper_bound = this.min_time + this.quantum;
      this.step_current = 0;
      $('#current_time').html('');
      $('#progress_bar > .bar').width(0);
      $('#pause_btn').html('<icon class="icon-play"></i>');
      return this.is_paused = false;
    };

    MapView.prototype.clear_lines = function(event) {
      var i, _results;
      _results = [];
      for (i in this.map._layers) {
        if (this.map._layers[i]._path !== undefined) {
          try {
            _results.push(this.map.removeLayer(this.map._layers[i]));
          } catch (e) {
            _results.push(console.log("problem with " + e + this.map._layers[i]));
          }
        } else {
          _results.push(void 0);
        }
      }
      return _results;
    };

    MapView.prototype.time_step = function(event) {
      var last_marker, lower_bound_str, upper_bound_str,
        _this = this;
      this.step_current += 1;
      if (this.step_current > this.num_steps) {
        this.is_paused = true;
        return this;
      }
      last_marker = void 0;
      this.markers.eachLayer(function(layer) {
        var _ref;
        if ((_this.lower_bound <= (_ref = layer.timestamp) && _ref <= _this.upper_bound)) {
          layer.setOpacity(1.0);
          return last_marker = layer;
        } else {
          return layer.setOpacity(0.0);
        }
      });
      if (last_marker != null) {
        this.map.panTo(last_marker.getLatLng());
      }
      this.progress = 100 * (this.upper_bound - this.min_time) / (this.max_time - this.min_time);
      lower_bound_str = new Date(this.lower_bound);
      upper_bound_str = new Date(this.upper_bound);
      $('#current_time').html("" + lower_bound_str + " through " + upper_bound_str);
      $('#progress_bar > .bar').width("" + this.progress + "%");
      this.upper_bound += this.quantum;
      return this;
    };

    MapView.prototype.time_c = function(event) {
      var con, d, d2, datum, datum2, days, geopoint, hours, i, minutes, parseDate, secs, start, start2, time, val, _j, _k, _len1, _ref5, _results;
      val = $("#tc_input").val();
      con = $("input:radio[name=const]:checked").val();
      time = $("input:radio[name=time]:checked").val();
      minutes = 1000 * 60;
      hours = minutes * 60;
      days = hours * 24;
      secs = void 0;
      for (i in this.map._layers) {
        if (this.map._layers[i]._path !== undefined) {
          try {
            this.map.removeLayer(this.map._layers[i]);
          } catch (e) {
            console.log("problem with " + e + this.map._layers[i]);
          }
        }
      }
      if (con === "day") {
        secs = days;
      } else if (con === "hour") {
        secs = hours;
      } else {
        if (con === "minute") {
          secs = minutes;
        }
      }
      _ref5 = this.data.models;
      _j = 0;
      _len1 = _ref5.length;
      _results = [];
      while (_j < (_len1 - 1)) {
        datum = _ref5[_j];
        parseDate = d3.time.format("%Y-%m-%dT%H:%M:%S").parse;
        if (time === "date") {
          try {
            start = Date.parse(this.data.models[_j].attributes.data.Time);
          } catch (err) {
            start = null;
          }
        } else {
          start = parseDate(this.data.models[_j].get("timestamp"));
        }
        d = Math.floor(start / secs);
        geopoint = datum.get("data")[this.map_headers].split(" ");
        this.pL = [];
        this.pL.push([parseFloat(geopoint[0]), parseFloat(geopoint[1])]);
        _k = _j + 1;
        _len1 = _ref5.length;
        while (_k < _len1) {
          if (start = null) {
            break;
          }
          datum2 = _ref5[_k];
          parseDate = d3.time.format("%Y-%m-%dT%H:%M:%S").parse;
          if (time === "date") {
            try {
              start2 = Date.parse(this.data.models[_k].attributes.data.Time);
            } catch (err) {
              start2 = null;
            }
          } else {
            start2 = parseDate(this.data.models[_k].get("timestamp"));
          }
          d2 = Math.floor(start2 / secs);
          geopoint = datum2.get("data")[this.map_headers].split(" ");
          if (val >= Math.abs(d - d2)) {
            this.pL.push([parseFloat(geopoint[0]), parseFloat(geopoint[1])]);
            this.poly = L.polyline(this.pL, this.pLStyle).addTo(this.map);
          } else {
            break;
          }
          _k++;
        }
        _results.push(_j++);
      }
      return _results;
    };

    return MapView;

  })(Backbone.View);
  return MapView;
});
