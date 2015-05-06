
var DATA_HOST = "http://aphyspc1.epfl.ch/meteolac/"; 
// Get the week number for the created date
function GetWeek(date) {
    var onejan = new Date(date.getFullYear(),0,1);
    return Math.ceil((((date - onejan) / 86400000) + onejan.getDay()+1)/7);
} 

function FirstDayOfWeek(week, year) { 

    if (year==null) {
        year = (new Date()).getFullYear();
    }

    var date       = firstWeekOfYear(year),
        weekTime   = weeksToMilliseconds(week),
        targetTime = date.getTime() + weekTime;

    return date.setTime(targetTime); 

}

function LastDayOfWeek(week, year) { 

    if (year==null) {
        year = (new Date()).getFullYear();
    }

    var date       = firstWeekOfYear(year),
        weekTime   = weeksToMilliseconds(week+1)-1,
        targetTime = date.getTime() + weekTime;

    return date.setTime(targetTime); 

}

function weeksToMilliseconds(weeks) {
    return 1000 * 60 * 60 * 24 * 7 * (weeks - 1);
}

function firstWeekOfYear(year) {
    var date = new Date();
    date = firstDayOfYear(date,year);
    date = firstWeekday(date);
    return date;
}

function firstDayOfYear(date, year) {
    date.setYear(year);
    date.setDate(1);
    date.setMonth(0);
    date.setHours(0);
    date.setMinutes(0);
    date.setSeconds(0);
    date.setMilliseconds(0);
    return date;
}

/**
 * Sets the given date as the first day of week of the first week of year.
 */
function firstWeekday(firstOfJanuaryDate) {
    // 0 correspond au dimanche et 6 correspond au samedi.
    var FIRST_DAY_OF_WEEK = 1; // Monday, according to iso8601
    var WEEK_LENGTH = 7; // 7 days per week
    var day = firstOfJanuaryDate.getDay();
    day = (day === 0) ? 7 : day; // make the days monday-sunday equals to 1-7 instead of 0-6
    var dayOffset=-day+FIRST_DAY_OF_WEEK; // dayOffset will correct the date in order to get a Monday
    if (WEEK_LENGTH-day+1<4) {
        // the current week has not the minimum 4 days required by iso 8601 => add one week
        dayOffset += WEEK_LENGTH;
    }
    return new Date(firstOfJanuaryDate.getTime()+dayOffset*24*60*60*1000);
}

/**
 * Returns the number of weeks in the given year
 */
function NumberOfWeeks(year) {
    var dec31 = new Date(year,11, 31);
    return GetWeek(dec31);
} 
var TemporalData = function(dataFolder, fieldName) {
	this.dataFolder = dataFolder;
	this.fieldName = fieldName;
	this.buffered = [];
	this.Data = undefined;
	this.DataTime = [];
	this.DataTime.Year = undefined;
	this.DataTime.Week = undefined;
}

TemporalData.prototype.PrepareData = function(week, year, callback) {
	var me = this;

	// Read the next data config
	this.readData(week, year, function(arr) { callback(); });

	return this;
}

TemporalData.prototype.X = function(arr, index, config) {
	var idx = config.GridHeight*(2+config.NumberOfValues*config.Timesteps)*parseInt(index/config.GridHeight) + (index % config.GridHeight);
	return arr[idx];
}

TemporalData.prototype.Y = function(arr, index, config) {
	var idx = config.GridHeight*(2+config.NumberOfValues*config.Timesteps)*parseInt(index/config.GridHeight) + (index % config.GridHeight) + config.GridHeight;
	return arr[idx];
}

TemporalData.prototype.V = function(arr, index, config) {
	var from = config.GridHeight*(2+config.NumberOfValues*config.Timesteps)*parseInt(index/config.GridHeight) + (index % config.GridHeight) + 2*config.GridHeight;

	var vals = [];
	for(var t = 0 ; t < config.Timesteps ; ++t) {
		var data = [];
		for(var i = 0 ; i < config.NumberOfValues ; ++i) {
			var idx = from + i*config.Timesteps*config.GridHeight + t*config.GridHeight;
			data.push(arr[idx]);
		}
		if(config.NumberOfValues == 1)
			vals.push(data[0]);
		else
			vals.push(data);
	}

	return vals;
}

TemporalData.prototype.SwitchToData = function(week, year) {
	this.DataTime.Year = year;
	this.DataTime.Week = week;
	this.Data = this.buffered[year + "_" + week];

	return this;
}

TemporalData.prototype.readData = function(week, year, callback) {
	var me = this;

	// If already buffered, do not read again
	if(me.buffered[year + "_" + week] != undefined)
		callback(me.buffered[year + "_" + week]);
	else {
		var valuesFile = DATA_HOST + me.dataFolder + "/" + year + "/" + me.fieldName + "/data_week" + week + ".csv"; 

		// Read the data config
		d3.json(valuesFile + ".json", function(err, config) {
			if(err) {
				console.log("File not found (" + valuesFile + ") falling back to default array");
				callback([]);
				return;	
			}
		
			me.readArray(valuesFile, config, function(arr) {
				me.buffered[year + "_" + week] = arr;
				callback(arr);
			});
		});
	}
	return this;
}

TemporalData.prototype.readArray = function(file, config, callback) {
	var me = this;

	d3.text(file, function(err, data) {
		if(err) {
			console.log("File not found (" + file + ") falling back to default array");
			callback([]);
			return;
		}
        // split data at line breaks and commas and parse the numbers
        var arr =  data.split(/[,\n]/).map(function(d) { return parseFloat(d); });
        var res = [];
        for(var i = 0 ; i < config.GridWidth*config.GridHeight ; ++i) {
        	var v =
        		{
        			x:me.X(arr, i, config),
        			y:me.Y(arr, i, config),
        			value:me.V(arr, i, config)
        		};
        	res.push(v);
        }

        me.recomputeBounds(res);

		callback(res);
	});

	return this;
}

TemporalData.prototype.recomputeBounds = function(res) {
	this.xMin = d3.min(res.map(function(t) { return t.x }));
	this.xMax = d3.max(res.map(function(t) { return t.x }));

	this.yMin = d3.min(res.map(function(t) { return t.y }));
	this.yMax = d3.max(res.map(function(t) { return t.y }));

	return this;
}
 
var Chart = function($scope, Time, containerId, conversionFct) {
    this.$scope = $scope
    this.Time = Time
    this.containerId = containerId
    this.chartCanvas = this.prepareChart()
    this.fct = conversionFct

    this.Max(0).Min(0)
}

Chart.prototype.Max = function(m) { this.max = m; return this; }
Chart.prototype.Min = function(m) { this.min = m; return this; }

Chart.prototype.Close = function() {
    $(this.containerId).fadeOut()
    this.$scope.pointIndex = undefined

    return this;
}

Chart.prototype.SelectPoint = function(i) {
	this.$scope.pointIndex = i
	this.UpdateChart()

    return this;
}

Chart.prototype.UpdateChart = function(dataTime) {
	if(!this.$scope.pointIndex)
		return this

	var p = this.$scope.tData.Data[this.$scope.pointIndex]

	if(!p)
		return this;

	$(this.containerId).fadeIn()

	var svg = this.chartCanvas.svg
	var width = this.chartCanvas.width
	var height = this.chartCanvas.height

	var tx = d3.scale.linear()
		.domain([0, p.value.length])
		.range([0, width])
    // assign it here, because the 'this' pointer is changed
    // inside callbacks. This way we can use 'tx' below
    this.tx = tx

    var fct = this.fct
	var y = d3.scale.linear()
		.domain([this.min, this.max])
		.range([height, 0])
    
	var line = d3.svg.line()
	    .interpolate("basis")
	    .x(function(d, i) { return tx(i); })
	    .y(function(d) { return y(fct(d)); });

	var plot = svg.selectAll(".plot").data([p])
	plot.exit().remove()

	plot.enter().append("path").attr("class", "plot")
	plot
		.transition()
		.duration(500)
		.attr("d", function(d) { return line(d.value) })

	// svg axis
    var me = this;
	var xAxis = d3.svg.axis().scale(tx).ticks(4).tickFormat(function(d) { return me.formatTime(d)}).orient("top")
    var yAxis = d3.svg.axis().scale(y).ticks(4).orient("right");

    svg.select(".x.axis").call(xAxis)
    svg.select(".y.axis").call(yAxis)

    return this;
}

Chart.prototype.formatTime = function(d) {
    var monday = new Date(FirstDayOfWeek(this.$scope.tData.DataTime.Week, this.$scope.tData.DataTime.Year));
    var hoursInAWeek = 7*24;
    var addedHours = d/this.Time.nT*hoursInAWeek;
    monday.setHours(monday.getHours() + addedHours);
    return monday.toDateString();
}

Chart.prototype.UpdateTimeLine = function() {
    if(this.tx)
        this.chartCanvas.svg.selectAll(".timeLine").attr("d", "M" + this.tx(this.Time.tIndex) + "," + 0 + " L" + this.tx(this.Time.tIndex) + "," + this.chartCanvas.height)

    return this;
}

Chart.prototype.prepareChart = function() {
    var me = this
    var drag = d3.behavior.drag().on("drag", function() { me.dragTime() })

    var chartCanvas = PrepareSvgCanvas(this.containerId + " div", 2)
    chartCanvas.svg.append("g")
        .attr("transform", "translate(0," + chartCanvas.height + ")")
        .attr("class", "x axis")
    chartCanvas.svg.append("g")
        .attr("transform", "translate(0,0)")
        .attr("class", "y axis")
    chartCanvas.svg.append("rect")
        .attr("width", chartCanvas.width)
        .attr("height", chartCanvas.height)
        .attr("fill", "none")
        .attr("pointer-events", "visible")
        .call(drag)
    chartCanvas.svg.append("g")
        .append("path")
        .attr("class", "timeLine")

    $(this.containerId).hide()

    return chartCanvas
}

Chart.prototype.dragTime = function() {
    this.Time.tIndex = parseInt(this.tx.invert(d3.event.x))
} 
var Particle = function(xOrigin, yOrigin, particleSize) {
	this.lifespan = 0;
	this._graphic = circle(xOrigin, yOrigin, particleSize, 0x0);
	this._origin = {x:xOrigin, y:yOrigin};
}

Particle.prototype.Tick = function(dT) {
	if(this.lifespan <= 0) {
		this.lifespan = 0;
		return;
	}

	this.lifespan -= dT;

	// Hide the particle if it is asleep
	this._graphic.sprite.visible = this.lifespan > 0;

	if(this.opacityAxis)
		this._graphic.sprite.alpha = this.opacityAxis(this.lifespan);

	this.move(this._xVel*dT, this._yVel*dT);
}

Particle.prototype.Shoot = function(xVel, yVel, lifespan) {
	this.lifespan = lifespan;
	this._xVel = xVel;
	this._yVel = yVel;
	this._graphic.graphic.position.x = this._origin.x;
	this._graphic.graphic.position.y = this._origin.y;

	if(!this.opacityAxis)
		this.opacityAxis = d3.scale.linear().domain([0, lifespan]).range([0, 1]);

	return this;
}

Particle.prototype.SetRenderer = function(stage) {
    stage.addChild(this._graphic.graphic);

    return this;
}

Particle.prototype.EnableInteractivity = function(mousedown, mouseover, mouseup) {
    this._graphic.sprite.interactive = true;
    this._graphic.sprite.mousedown = mousedown;
    this._graphic.sprite.mouseover = mouseover;
    this._graphic.sprite.mouseup = mouseup;
}

Particle.prototype.SetColor = function(color) {
	this._graphic.sprite.tint = color;

	return this;
}

Particle.prototype.move = function(dX, dY) {
	this._graphic.graphic.position.x += dX;
	this._graphic.graphic.position.y += dY;

	return this;
} 
var ParticleEmitter = function(xPos, yPos, particleSize, lifespan, maxParticles) {
	// Default values for parameters
	lifespan = typeof lifespan !== 'undefined' ? lifespan : 0.5;
	maxParticles = typeof maxParticles !== 'undefined' ? maxParticles : 4;

	this._particles = [];
	for(var i = 0 ; i < maxParticles ; ++i)
		this._particles.push(new Particle(xPos, yPos, particleSize));
	this._particleLifespan = lifespan;
	this._nextParticleIdx = 0;
}

ParticleEmitter.prototype.Tick = function(dT) {
	for(var i = this._particles.length - 1 ; i >= 0 ; --i) {
		this._particles[i].Tick(dT);
	}
}

ParticleEmitter.prototype.SetRenderer = function(stage) {
	for(var i = 0 ; i < this._particles.length ; ++i)
		this._particles[i].SetRenderer(stage);
}

ParticleEmitter.prototype.EnableParticleInteractivity = function(mousedown, mouseover, mouseup) {
	for(var i = 0 ; i < this._particles.length ; ++i)
		this._particles[i].EnableInteractivity(mousedown, mouseover, mouseup);
}

ParticleEmitter.prototype.Emit = function(xVel, yVel, color) {
	var p = this.getFreeParticle();

	if(p == null) return;

	p.Shoot(xVel, yVel, this._particleLifespan)
		.SetColor(color);
}

ParticleEmitter.prototype.getFreeParticle = function() {
	var p = this._particles[this._nextParticleIdx];
	this._nextParticleIdx = (this._nextParticleIdx + 1 ) % this._particles.length;
	return p;
}
 
var app = angular.module("app", []);

// Factory for a shared time index variable, so that all 
// graphs can access it
app.factory("Time", function() {

    return { 
        tIndex: 0,
        nT: 7*24*60, // number of time steps in a week
        increase: function(loop) {
            if(loop) {
                this.tIndex ++;
                if(this.tIndex >= this.nT)
                    this.tIndex = 0;
            } else
                this.tIndex = Math.min(this.nT-1, this.tIndex+1);
        },
        decrease: function() {
            this.tIndex = Math.max(0, this.tIndex-1);
        },
        recomputeTimesteps: function(interval) {
            this.nT = 7*24*60/interval;
        }
    };
})

function PrepareCanvas(containerId, aspectRatio) {
	return Prepare("canvas", containerId, aspectRatio);
}

function PrepareSvgCanvas(containerId, aspectRatio) {
	return Prepare("svg", containerId, aspectRatio);
}

function PrepareWebGLContext(containerId, interactive, aspectRatio) {
    // create an new instance of a pixi stage
    var stage = new PIXI.Stage(0xFFFFFF, interactive);

    // create a renderer instance.
    var container = d3.select(containerId);

    var dim = findDimensions(container, aspectRatio);
    var width = dim.width;
    var height = dim.height;
    var renderer = PIXI.autoDetectRenderer(width, height);

    // add the renderer view element to the DOM
    container.style("height", height).node().appendChild(renderer.view);

    return {stage:stage, renderer:renderer, width:width, height:height};
}

function Prepare(type, containerId, aspectRatio) {
	var container = d3.select(containerId);

    var dim = findDimensions(container, aspectRatio);
    container.style("height", dim.height);

	return {svg:container.append(type).attr("width", dim.width).attr("height", dim.height), width:dim.width, height:dim.height};
}

function findDimensions(container, aspectRatio) {
	var width = parseInt(container.style("width"));

    // adapt the height to fit the given width
    return {width:width, height:width/aspectRatio};
}

function zip(arrays) {
    return arrays[0].map(function(_,i){
        return arrays.map(function(array){return array[i]});
    });
}

// taken from http://www.html5gamedevs.com/topic/3114-question-about-rectangle-drawing/
var rectColorTextures = {};
function getRectTexture(color) {
    if(rectColorTextures[color] === undefined) {
        var canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        ctx = canvas.getContext('2d');
        ctx.fillStyle = '#' + color.toString(16);
        ctx.beginPath();
        ctx.rect(0,0,1,1);
        ctx.fill();
        ctx.closePath();
        rectColorTextures[color] = PIXI.Texture.fromCanvas(canvas);
    }
    return rectColorTextures[color];
};

var circleColorTextures = {};
function getCircleTexture(color) {
    if(circleColorTextures[color] === undefined) {
        var canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        ctx = canvas.getContext('2d');
        ctx.fillStyle = '#' + color.toString(16);
        ctx.beginPath();
        ctx.arc(0,0,1,0, 2*Math.PI);
        ctx.fill();
        ctx.closePath();
        circleColorTextures[color] = PIXI.Texture.fromCanvas(canvas);
    }
    return circleColorTextures[color];
};

function rectangle(x, y, width, height, backgroundColor) { 
    var box = new PIXI.DisplayObjectContainer();
    var background = new PIXI.Sprite(getRectTexture(0xFFFFFF));
    background.tint = backgroundColor;
    background.width = width;
    background.height = height;
    background.position.x = 0;
    background.position.y = 0;
    box.addChild(background);
    box.position.x = x;
    box.position.y = y;
    return {graphic:box, sprite:background};
};

function circle(x, y, radius, backgroundColor) { 
    var box = new PIXI.DisplayObjectContainer();
    var background = new PIXI.Sprite(getCircleTexture(0xFFFFFF)); //new PIXI.Sprite.fromImage("/files/content/sites/aphys/files/MeteoLac/dot.png");
    background.tint = backgroundColor;
    background.width = radius*2;
    background.height = radius*2;
    background.position.x = 0;
    background.position.y = 0;
    box.addChild(background);
    box.position.x = x - radius/2;
    box.position.y = y - radius/2;
    return {graphic:box, sprite:background};
};

/* Constructs a line from the given starting point to the given ending point.
 * Actually constructs a rectangle sprite and rotates it accordingly.
 * To Change the length of the line, change its o.graphic.width attribute.
 */
function line(x1, y1, x2, y2, height, color) {
    //var length = Math.sqrt((x2-x1)*(x2-x1) + (y2-y1)*(y2-y1));

    //var graphics = rectangle(x1, y1-height/2, length, height, color);
    var graphics = new PIXI.Graphics();
    graphics.beginFill(0xFF0000);
    graphics.lineStyle(height, color);

    graphics.moveTo(x1, y1);
    graphics.lineTo(x2, y2);

     // the angle in radians of the line
     var angle = Math.atan2(y2-y1, x2-x1);

     // rotate that angle
     //graphics.graphic.rotation = angle;

    return {graphic: graphics};
}

function arrow(x1, y1, dx, dy, width, color) {
    var alpha = 30*Math.PI/180.0;
    var headSize = 5;

    var norm = Math.sqrt(dx*dx + dy*dy);

    var x3 = x1 + dx - (dx*Math.cos(alpha) - dy*Math.sin(alpha))/norm*headSize;
    var y3 = y1 + dy - (dx*Math.sin(alpha) + dy*Math.cos(alpha))/norm*headSize;

    var x4 = x1 + dx - (dx*Math.cos(-alpha) - dy*Math.sin(-alpha))/norm*headSize;
    var y4 = y1 + dy - (dx*Math.sin(-alpha) + dy*Math.cos(-alpha))/norm*headSize;

    var graphicArrow = new PIXI.DisplayObjectContainer();

    graphicArrow.position.x = x1 + dx/2;
    graphicArrow.position.y = y1 + dy/2;

    // arrow head
    var head = new PIXI.Graphics();
    head.beginFill(0xFF0000);
    head.lineStyle(width, color);

    head.moveTo(graphicArrow.position.x - (x1 + dx), graphicArrow.position.y - (y1 + dy));
    head.lineTo(graphicArrow.position.x - x3, graphicArrow.position.y - y3);
    head.lineTo(graphicArrow.position.x - x4, graphicArrow.position.y - y4);
    head.endFill();
    graphicArrow.addChild(head);

    // arrow body
    var body = new PIXI.Graphics();
    body.beginFill(0xFF0000);
    body.lineStyle(width, color);

    body.moveTo(graphicArrow.position.x - x1, graphicArrow.position.y - y1);
    body.lineTo(graphicArrow.position.x - (x1 + dx), graphicArrow.position.y - (y1 + dy));
    body.endFill();
    graphicArrow.addChild(body);

     // the angle in radians of the line
     var angle = Math.atan2(dy, dx);

     // rotate that angle
     //graphicArrow.rotation = angle;

    return {graphic: graphicArrow};
} 
app.controller("temperatureCtrl", ["$rootScope", "$scope", "Time", function($rootScope, $scope, Time) {

	// ========================================================================
	// PROPERTIES
	// ========================================================================

	var webgl = PrepareWebGLContext("#tempContainer", true, 2);
	var width = webgl.width;
	var height = webgl.height;
	var stage = webgl.stage;
	var renderer = webgl.renderer;
	var markerSprite;
	var sprites = [];

	var isDataReady = false;

	var x,y,c; // d3 axis
	var rectSize;

	var colorLegend = prepareLegend();

	var mouseDown = false;

	Initialize();

	// ========================================================================
	// INIT (I know, code above is also some initialization. Deal with it.)
	// ========================================================================
	function Initialize() {
		$rootScope.$on("reloadWeek", function(evt, time) {
			isDataReady = false;

			if($scope.tData && !time.fullReload) {
				// Regular switching of weeks, because the time slider was moving forward.
				$scope.tData.SwitchToData(time.week, time.year).PrepareData(time.week+1, time.year, function() { 
					dataReady();
				});
			} else if($scope.tData && time.fullReload) {
				// User changed the date in the lists.
				// Typically means that the required data and the next data are not ready yet.
				$scope.tData.PrepareData(time.week, time.year, function() {
					$scope.tData.SwitchToData(time.week, time.year);
					dataReady();
					prepareGraphics();
				});
				$scope.tData.PrepareData(time.week+1, time.year, function() {});
			} else {
				$scope.tData = new TemporalData(time.folder, 'temperature');
				$scope.tData.PrepareData(time.week, time.year, function() {
					$scope.tData.SwitchToData(time.week, time.year);

					dataReady();
					prepareGraphics();

					// Load the next file
			    	$scope.tData.PrepareData(time.week+1, time.year, function() {});
				});
			}
		})

		$scope.Chart = new Chart($scope, Time, "#tempPlot", function(d) { return d })
		$rootScope.$on("reloadChart", function(evt, pointIndex) {
			$scope.Chart.SelectPoint(pointIndex);
		})

		// start the renderer
		d3.timer(animate);

		$rootScope.$emit("scopeReady");		
	}

	// ========================================================================
    // UTILITY FUNCTIONS
    // ========================================================================

	function dataReady() {
	    var xmargin = width*0.1;
	    var ymargin = height*0.1;
	    x = d3.scale.linear().domain([$scope.tData.xMin, $scope.tData.xMax]).range([0+xmargin, width-xmargin]);
	    y = d3.scale.linear().domain([$scope.tData.yMin, $scope.tData.yMax]).range([height-ymargin, 0+ymargin]);

	    var tMin = d3.min($scope.tData.Data.map(function(d) { return d3.min(d.value) }));
	    var tMax = d3.max($scope.tData.Data.map(function(d) { return d3.max(d.value) }));

	    c = d3.scale.linear().domain([tMin, (tMin+tMax)/2, tMax]).range(["blue", "lime", "red"]);

	    // Prepare all thingies
	    updateLegend(tMin, tMax);
	    $scope.Chart.UpdateChart($scope.tData.DataTime).Max(tMax).Min(tMin);

	    isDataReady = true;
	}

	function prepareGraphics() {
	    var rectSize = x(700) - x(0);

	    // Clear the stage
	    for (var i = stage.children.length - 1; i >= 0; i--) {
			stage.removeChild(stage.children[i]);
		};

	    $scope.tData.Data.forEach(function(d, i) {
	        var doc = rectangle(x(d.x)-rectSize/2, y(d.y)-rectSize/2,
	            rectSize,rectSize,
	            parseInt(c(d.value[Time.tIndex]).toString().replace("#", "0x")));
	        stage.addChild(doc.graphic);
	        sprites[i] = doc;
	        sprites[i].sprite.interactive = true;
	        sprites[i].sprite.mousedown = function(mouseData) { $rootScope.$emit("reloadChart", i); mouseDown = true; }
	        sprites[i].sprite.mouseover = function(mouseData) { if(!mouseDown) return; $rootScope.$emit("reloadChart", i); }
	        sprites[i].sprite.mouseup = function(mouseData) { mouseDown = false; }
	    })

	    // Prepare the marker symbol
	    if(typeof(DEV_ENV) == "undefined")
	    	markerSprite = new PIXI.Sprite.fromImage("/files/content/sites/aphys/files/MeteoLac/marker.png");
		else
			markerSprite = new PIXI.Sprite.fromImage("marker.png");
	    markerSprite.width = 50;
	    markerSprite.height = 50;
	    stage.addChild(markerSprite);
	    markerSprite.visible = false;    
	}

	function prepareLegend() {
		var w = 300, h = 120;
		key = d3.select("#tempLegend").append("svg").attr("id", "key").attr("width", w).attr("height", h);
		legend = key.append("defs").append("svg:linearGradient").attr("id", "gradient").attr("x1", "0%").attr("y1", "100%").attr("x2", "100%").attr("y2", "100%").attr("spreadMethod", "pad");
		legend.append("stop").attr("offset", "0%").attr("stop-color", "blue").attr("stop-opacity", 1);
		legend.append("stop").attr("offset", "50%").attr("stop-color", "lime").attr("stop-opacity", 1);
		legend.append("stop").attr("offset", "100%").attr("stop-color", "red").attr("stop-opacity", 1);
		key.append("rect").attr("width", w - 100).attr("height", h - 100).style("fill", "url(#gradient)")
		var color = key.append("g").attr("class", "x axis").attr("transform", "translate(0,22)");
		color.append("text").attr("y", 42).attr("dx", ".71em").style("text-anchor", "start").text("Temperature (°C)");
		return color;
	}

	function updateLegend(tMin, tMax) {
		var x = d3.scale.linear().range([0, 200]).domain([tMin, tMax]);
		var xAxis = d3.svg.axis().scale(x).ticks(4).orient("bottom");
		colorLegend.call(xAxis);
	}

	function animate() {
		if(!isDataReady) return;

	    // Animate the stuff here (transitions, color updates etc.)
		var rectSize = x(700) - x(0);
	    $scope.tData.Data.forEach(function(d, i) {
	    	if(Time.tIndex >= d.value.length) return;
	    	
	        var value = d.value[Time.tIndex];
	        sprites[i].sprite.visible = !isNaN(d.value[Time.tIndex]);
     	   	var color = parseInt(c(value).toString().replace("#", "0x"));
			sprites[i].sprite.tint = color;
	    })

	    // Put the marker sprite at the correct position
	    markerSprite.visible = $scope.pointIndex != undefined;
	    if($scope.pointIndex != undefined) {
	    	markerSprite.position.x = x($scope.tData.Data[$scope.pointIndex].x) - markerSprite.width / 2;
	    	markerSprite.position.y = y($scope.tData.Data[$scope.pointIndex].y) - markerSprite.height / 2;
	    }

	    // render the stage
	    renderer.render(stage);

	    // render the timeline on the chart
	    $scope.Chart.UpdateTimeLine();
	}
}]); 
app.controller("velocityCtrl", ["$rootScope", "$scope", "Time", function($rootScope, $scope, Time) {

	// ========================================================================
	// PROPERTIES
	// ========================================================================

	var lengthFactor = 1;
	var webgl = PrepareWebGLContext("#velContainer", true, 2);
	var width = webgl.width;
	var height = webgl.height;
	var stage = webgl.stage;
	var renderer = webgl.renderer;
	var markerSprite = null;

	var isDataReady = false;

    var x,y,c; // d3 axis (x,y, color)
	var rectSize;
	var sprites = [];
	var lines = [];

    var colorLegend = prepareLegend();

	var mouseDown = false;
	
	Initialize();

	// ========================================================================
	// INIT (I know, code above is also initialization. Deal with it.)
	// ========================================================================
	function Initialize() {
		$rootScope.$on("reloadWeek", function(evt, time) {
			isDataReady = false;

			if($scope.tData && !time.fullReload) {
				// Regular switching of weeks, because the time slider was moving forward.
				$scope.tData.SwitchToData(time.week, time.year).PrepareData(time.week+1, time.year, function() { 
					dataReady();
				});
			} else if($scope.tData && time.fullReload) {
				// User changed the date in the lists.
				// Typically means that the required data and the next data are not ready yet.
				$scope.tData.PrepareData(time.week, time.year, function() {
					$scope.tData.SwitchToData(time.week, time.year);
					dataReady();
					prepareGraphics();
				});
				$scope.tData.PrepareData(time.week+1, time.year, function() {});
			} else {
				// First time initialization. Load the required data and the next.
				$scope.tData = new TemporalData(time.folder, 'velocity');
				$scope.tData.PrepareData(time.week, time.year, function() {
					$scope.tData.SwitchToData(time.week, time.year);

					dataReady();
					prepareGraphics();

					// Load the next file
			    	$scope.tData.PrepareData(time.week+1, time.year, function() {});
				});
			}
		})

		$scope.Chart = new Chart($scope, Time, "#velPlot", function(d) { return norm(d); })
	    $rootScope.$on("reloadChart", function(evt, pointIndex) {
			$scope.Chart.SelectPoint(pointIndex);
		})

		// start the renderer
		d3.timer(animate);
	
		$rootScope.$emit("scopeReady");
	}

	// ========================================================================
	// UTILITY FUNCTIONS
	// ========================================================================

	/*
	 * Call this method whenever a new bunch of data has been read and is ready
	 * to be displayed. 
	 * Updates the legend and the axis.
	 */
	function dataReady() {
	    var xmargin = width*0.1;
	    var ymargin = height*0.1;
	    x = d3.scale.linear().domain([$scope.tData.xMin, $scope.tData.xMax]).range([0+xmargin, width-xmargin]);
	    y = d3.scale.linear().domain([$scope.tData.yMin, $scope.tData.yMax]).range([height-ymargin, 0+ymargin]);

	    var minVel = d3.min($scope.tData.Data.map(function(d) { return d3.min(d.value.map(function(v) { return norm(v); })) }));
		var maxVel = d3.max($scope.tData.Data.map(function(d) { return d3.max(d.value.map(function(v) { return norm(v); })) }));

	    c = d3.scale.linear().domain([minVel, (minVel+maxVel)/2, maxVel]).range(["blue", "lime", "red"]);

	    // Prepare all thingies
	    updateLegend(minVel, maxVel);
	    $scope.Chart.UpdateChart($scope.tData.DataTime).Max(maxVel).Min(minVel);

	    isDataReady = true;
	}

	/*
	 * 
	 */
	function prepareGraphics() {
	    var rectSize = x(50) - x(0);

	    // Clear the stage
	    for (var i = stage.children.length - 1; i >= 0; i--) {
			stage.removeChild(stage.children[i]);
		};

	    $scope.tData.Data.forEach(function(d, i) {

	    	// Clickable dots at grid locations
	        /*var doc = circle(x(d.x), y(d.y), rectSize, "0x000000");
	        stage.addChild(doc.graphic);
	        sprites[i] = doc;
	        sprites[i].sprite.interactive = true;
	        sprites[i].sprite.mousedown = function(mouseData) { $rootScope.$emit("reloadChart", i); mouseDown = true; }
	        sprites[i].sprite.mouseover = function(mouseData) { if(!mouseDown) return; $rootScope.$emit("reloadChart", i); }
	        sprites[i].sprite.mouseup = function(mouseData) { mouseDown = false; }*/

	        // Animated lines on top
	        
	        var lineWidth = 1;
	        var li = arrow(x(d.x), y(d.y), -10, 0, lineWidth, "0x000000");
	        lines[i] = li;
	        stage.addChild(li.graphic);
	    });

	    // Prepare the marker symbol
	    if(typeof(DEV_ENV) == "undefined")
	    	markerSprite = new PIXI.Sprite.fromImage("/files/content/sites/aphys/files/MeteoLac/marker.png");
		else
			markerSprite = new PIXI.Sprite.fromImage("marker.png");
	    markerSprite.width = 50;
	    markerSprite.height = 50;
	    stage.addChild(markerSprite);
	    markerSprite.visible = false;
	}

	function prepareLegend() {
		var w = 300, h = 120;
		key = d3.select("#velLegend").append("svg").attr("id", "key").attr("width", w).attr("height", h);
		legend = key.append("defs").append("svg:linearGradient").attr("id", "gradient").attr("x1", "0%").attr("y1", "100%").attr("x2", "100%").attr("y2", "100%").attr("spreadMethod", "pad");
		legend.append("stop").attr("offset", "0%").attr("stop-color", "blue").attr("stop-opacity", 1);
		legend.append("stop").attr("offset", "50%").attr("stop-color", "lime").attr("stop-opacity", 1);
		legend.append("stop").attr("offset", "100%").attr("stop-color", "red").attr("stop-opacity", 1);
		key.append("rect").attr("width", w - 100).attr("height", h - 100).style("fill", "url(#gradient)");
		var color = key.append("g").attr("class", "x axis").attr("transform", "translate(0,22)");
		color.append("text").attr("y", 42).attr("dx", ".71em").style("text-anchor", "start").text("Velocity (m/s)");		
		return color;
	}

	function updateLegend(minVel, maxVel) {
		var x = d3.scale.linear().range([0, 200]).domain([minVel, maxVel]);
		var xAxis = d3.svg.axis().scale(x).ticks(4).orient("bottom");
		colorLegend.call(xAxis);
	}

	/*
	 * This function runs under a timer. It is in charge of rendering the canvas.
	 * Do not call this directly.
	 */
	function animate() {
		if(!isDataReady) return;

	    // Animate the stuff here (transitions, color updates etc.)
		var rectSize = x(10) - x(0);
	    $scope.tData.Data.forEach(function(d, i) {
	    	if(Time.tIndex >= d.value.length) return;

	        var value = d.value[Time.tIndex];

	        if(!value) return;
	        
		    var angle = Math.atan2(value[1], value[0]);
		    lines[i].graphic.rotation = angle;

		    //var s = 100*norm(value);
		  	//lines[i].graphic.scale.x = s < 0.1 ? 0 : s;// 1000*norm(value);

		    var color = parseInt(c(norm(value)).toString().replace("#", "0x"));
			lines[i].graphic.tint = color;
	    })

	    // DEPRECATED: The velocity now uses a reduced spatial resolution.
	    // This means that the pointIndex does not represent a correct index
	    // anymore. Either recalculate the correct index or leave this portion
	    // commented...

	    // Put the marker sprite at the correct position
	    /*markerSprite.visible = $scope.pointIndex != undefined;
	    if($scope.pointIndex != undefined) {
	    	markerSprite.position.x = x($scope.tData.Data[$scope.pointIndex].x) - markerSprite.width / 2;
	    	markerSprite.position.y = y($scope.tData.Data[$scope.pointIndex].y) - markerSprite.height / 2;
	    }*/

	    $scope.$apply();

	    // render the stage
	    renderer.render(stage);

	    // render the timeline on the chart
	    $scope.Chart.UpdateTimeLine()
	}

	/*
	 * Returns the norm of a vector.
	 * The vector is expected to be an array [x,y].
	 */
    function norm(vec) {
    	return vec[0]*vec[0] + vec[1]*vec[1];
    }
}]) 
app.controller("timeCtrl", ["$rootScope", "$scope", "Time", function($rootScope, $scope, Time) {

    var tickTimerId = null;
    var loopType = "repeat";

    $scope.Interval = 0;

    // ------------------------------------------------------------------------
    // BOUND TO THE HTML
    // ------------------------------------------------------------------------

	$scope.play = function() {
		$("#playButton span").toggleClass("glyphicon-play glyphicon-pause");

		loopType = "repeat";

		if(tickTimerId == null)
			tickTimerId = setInterval(tick, 60);
		else
			$scope.pause();
	}

	$scope.playAll = function() {
		// Play, but instead of looping move to the next week
		$scope.play();
		loopType = "continue";
	}

	$scope.pause = function() {
		clearInterval(tickTimerId);
		tickTimerId = null;
	}
	$scope.backward = function() {
		Time.decrease();
	}
	$scope.forward = function() {
		Time.increase(true);
	}

	$scope.stop = function() {
		if(tickTimerId != null)
			$("#playButton span").toggleClass("glyphicon-play glyphicon-pause");

		$scope.pause();
		Time.tIndex = 0;
	}	

    $scope.getTime = function() {
    	return $scope.PrettyPrintTime(Time.tIndex, $scope.SelectedWeek, $scope.SelectedYear);
    }

	$scope.PrettyPrintTime = function(ti, weekNo, year) {
		var refDate = FirstDayOfWeek(weekNo, year);

		// tIndex corresponds to intervals, which are given by the global INTERVAL
		// in minutes, so we need to convert it into milliseconds
		var currentDate = new Date(refDate + ti*$scope.Interval*60*1000);
		return currentDate.toLocaleDateString() + ":" + currentDate.getHours() + "h"; 	
	}

	$scope.PrettyPrintWeek = function(week) {
		var firstDay = FirstDayOfWeek(week, $scope.SelectedYear);
		var lastDay = LastDayOfWeek(week, $scope.SelectedYear);
		return new Date(firstDay).toLocaleDateString() + " - " + new Date(lastDay).toLocaleDateString();
	}

	$scope.ChangeWeek = function(week) {
		$scope.selectWeek(week);
		emitFullReload();
	}

	$scope.ChangeYear = function(year) {
		$scope.selectYear(year);
		emitFullReload();
	}

	// ------------------------------------------------------------------------
	// UTILITY METHODS
	// ------------------------------------------------------------------------

	$scope.selectWeek = function(week) {
		// Make sure the given week number is not out of bounds with the 
		// current year, and change year if necessary.
		var numberOfWeeks = NumberOfWeeks($scope.SelectedYear);
		if(week >= numberOfWeeks) {
			$scope.selectYear($scope.SelectedYear+1);
			$scope.selectWeek(week - numberOfWeeks + 1);
			return;
		} else if(week < 0) {
			$scope.selectYear --;
			$scope.selectWeek(week + numberOfWeeks);
			return;
		}

		$scope.SelectedWeek = week;
	}

	$scope.selectYear = function(year) {
		$scope.SelectedYear = year;
		$scope.Weeks = [];
		for(var week in $scope.Dates[$scope.SelectedLake]["data"]["Y" + $scope.SelectedYear]) {
			$scope.Weeks.push(week);
		}
	}

    function tick() {
    	Time.increase(true);

    	$rootScope.$emit("tick");

    	if(Time.tIndex == 0) {
    		// we looped. Decide whether we play again the current week
    		// or if we play the next week
    		if(loopType == "continue") {
    		    $scope.selectWeek($scope.SelectedWeek+1);
    		    emitReload();
    		}
    	}

		$scope.$apply();
    }

    /**
     * Emit a "reloadWeek" message, indicating that the time has passed to 
     * a new week.
     */
	function emitReload() {
		$rootScope.$emit("reloadWeek", {week:$scope.SelectedWeek, year:$scope.SelectedYear, fullReload:false, folder:$scope.Dates[$scope.SelectedLake]["folder"]});
	}
	/**
	 * Emit a "reloadWeek" message, indicating that the user changed a 
	 * parameter in the time fields and that all data needs to be reloaded.
	 */
	function emitFullReload() {
		$rootScope.$emit("reloadWeek", {week:$scope.SelectedWeek, year:$scope.SelectedYear, fullReload:true, folder:$scope.Dates[$scope.SelectedLake]["folder"]});
	}

	function loadAvailableDates(callback) {
		$scope.Weeks = [];
		$scope.SelectedWeek = undefined;
		$scope.Years = [];
		$scope.SelectedYear = undefined;

		d3.json(DATA_HOST + "available_data.json", function(err, data) {
			$scope.Dates = data;
			$scope.SelectedLake = 0; // first one in the array of lakes (i.e. data[0])
			$scope.Interval = data[$scope.SelectedLake].interval;
			Time.recomputeTimesteps($scope.Interval);
			callback();
		});
	}

	function selectWeekClosestToNow() {
		var now = new Date();
		var currentWeek = GetWeek(now);

		// Find the week closest to now
		var diffWeek = Number.MAX_VALUE; // large initial value for week diff
		$scope.Weeks = [];
		for(var i = 0 ; i <  $scope.Dates[$scope.SelectedLake]["data"]["Y" + $scope.SelectedYear].length ; ++i) {
			var week = $scope.Dates[$scope.SelectedLake]["data"]["Y" + $scope.SelectedYear][i];
			
			$scope.Weeks.push(week);
			if(Math.abs(week - currentWeek) < diffWeek) {
				$scope.SelectedWeek = week;
			}
		}
	}

	function selectDateClosestToNow() {
		var now = new Date();
		var currentYear = now.getFullYear();
		
		// Find the year closest to now
		var diffYear = Number.MAX_VALUE; // take a large initial value for year diff
		$scope.Years = [];
		for(var syear in $scope.Dates[$scope.SelectedLake]["data"]) {
			var year = parseInt(syear.substring(1));
			$scope.Years.push(year);
			if(Math.abs(year-currentYear) < diffYear) {
				$scope.SelectedYear = year;
			}
		}

		selectWeekClosestToNow();

		emitReload();
	}

	loadAvailableDates(selectDateClosestToNow);

	// When a controller is ready, tell it the selected year/week to load
	$rootScope.$on("scopeReady", function() {
		if($scope.Dates)
			emitReload();
	})

	$scope.Time = Time;


	// UI Logic to hide/show the sidebar time controls when scrolling
	$(".sidebar").hide()
	$(document).scroll(function() {
		if (!isScrolledIntoView($("#timeControls"))) {
			$('.sidebar').fadeIn();
		} else {
			$('.sidebar').fadeOut();
		}
	});

	function isScrolledIntoView(elem) {
	    var docViewTop = $(window).scrollTop();
	    var docViewBottom = docViewTop + $(window).height();

	    var elemTop = $(elem).offset().top;
	    var elemBottom = elemTop + $(elem).height();

	    return ((elemBottom <= docViewBottom) && (elemTop >= docViewTop));
	}	
}]);
 
