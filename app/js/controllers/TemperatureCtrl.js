angular.module('lakeViewApp').controller('TemperatureCtrl', function($scope, $q, Time, TemporalData, NearestNeighbor) {
    var colorFunctions;
    var nearestNeighbor;
    var animationHandlers = [];

    $scope.LEGEND_COLORS = ['blue', 'cyan', 'lime', 'yellow', 'red'];
    $scope.BUCHILLON_URL = 'http://meteolakes.epfl.ch/graph-view/beta/';

    $scope.tab = 'surface';
    $scope.timeSelection = null;

    $scope.surfaceData = new TemporalData('temperature', 0.03);
    $scope.sliceXZData = new TemporalData('temperature', 0, '_slice_xz');
    $scope.sliceYZData = new TemporalData('temperature', 0, '_slice_yz');
    var dataSources = ['surface', 'sliceXZ', 'sliceYZ'];

    $scope.$on('updateTimeSelection', function(evt, timeSelection) {
        colorFunctions = {};
        $scope.timeSelection = timeSelection;
        $scope.closeChart();

        // Load metadata of all tabs to update tab availabilities
        dataSources.forEach(function(source) {
            $scope[source + 'Data'].setTimeSelection(timeSelection).then(function() {
                if (source === $scope.tab) {
                    // Start reading data of current tab once metadata are ready
                    loadCurrentData();
                }
            });
        });
    });

    $scope.$on('tick', animate);

    $scope.$watch('chartPoint', updateChart);

    $scope.addAnimationHandler = function(handler) {
        animationHandlers.push(handler);
    };

    $scope.closeChart = function() {
        $scope.chartPoint = null;
    };

    $scope.initMap = function(map) {
        // Buchillon station marker
        var stationIcon = L.icon({
            iconUrl: 'img/stats.png',
            iconSize: [26, 25], // size of the icon
            iconAnchor: [0, 24], // point of the icon which will correspond to marker's location
            popupAnchor: [12, -27] // point from which the popup should open rel. to iconAnchor
        });
        L.marker({ lat: 46.45839177832672, lng: 6.399359513724266 }, { icon: stationIcon }).addTo(map).bindPopup('<a href="' + $scope.BUCHILLON_URL + '">Buchillon measuring station (Beta)</a>');
    };

    $scope.drawTemperatureOverlay = function(data, options) {
        var colorFunction = colorFunctions[options.dataSource];

        var size = options.size;
        var graphics = new PIXI.Graphics();

        if (!colorFunction || $scope.tab !== options.dataSource) {
            return graphics;
        }

        if (options.background) {
            var origin = options.project([0, 0]);
            graphics.beginFill(0x4682B4);
            graphics.drawRect(0, 0, size.x, origin.y);
            graphics.endFill();
            graphics.beginFill(0x896E53);
            graphics.drawRect(0, origin.y, size.x, size.y);
            graphics.endFill();
        }

        var bounds = new L.Bounds(L.point([0, 0]), size);

        // Loop over the grid to draw a quadrilateral (polygon with 4 vertices)
        // colored according to the local temperature for every point except
        // for the last row/column. The coordinates of neighboring points
        // from the next row/column are used to define the quadrilateral, which
        // is why the last row/column cannot be used.
        for (var i = 0; i < data.length - 1; i++) {
            var row = data[i];
            var nextRow = data[i + 1];
            for (var j = 0; j < row.length - 1; j++) {
                // The 4 points of the quadrilateral
                var points = [row[j], row[j + 1], nextRow[j], nextRow[j + 1]];

                // Check if all points are defined
                if (points.every(function(p) { return p; })) {
                    // Check if any point is within bounds
                    if (points.some(function(p) { return bounds.contains(p.p); })) {
                        var color = colorFunction(row[j].values[Time.tIndex]);

                        var p00 = points[0].p;
                        var p01 = points[1].p;
                        var p10 = points[2].p;
                        var p11 = points[3].p;

                        graphics.beginFill(+color.replace('#', '0x'));
                        graphics.moveTo(p00.x, p00.y);
                        graphics.lineTo(p01.x, p01.y);
                        graphics.lineTo(p11.x, p11.y);
                        graphics.lineTo(p10.x, p10.y);
                        graphics.endFill();
                    }
                }
            }
        }

        return graphics;
    };

    $scope.mapClicked = function(point) {
        $scope.chartPoint = nearestNeighbor.query(point);
    };

    $scope.sliceClicked = function(point) {
        $scope.chartPoint = point;
    };

    $scope.setTab = function(tab) {
        $scope.closeChart();
        $scope.tab = tab;
        $scope.$emit('tTabChanged');
        loadCurrentData();
    };

    function loadCurrentData() {
        var source = $scope.tab;
        var temporalData = $scope[source + 'Data'];
        if (!temporalData.available && source !== 'surface') {
            $scope.setTab('surface');
        } else if (temporalData.ready) {
            $scope.$emit('tDataReady');
        } else {
            temporalData.readData().then(function() {
                colorFunctions[source] = generateColorFunction(temporalData.scaleExtent);
                if (source === 'surface') {
                    nearestNeighbor = NearestNeighbor($scope.surfaceData);
                }
                $scope[source + 'Extent'] = temporalData.scaleExtent; // This one is used for the color legend
                $scope.$emit('tDataReady');
            });
        }
    }

    function generateColorFunction(extent) {
        var minValue = extent[0];
        var maxValue = extent[1];

        var domain = $scope.LEGEND_COLORS.map(function(d, i) {
            return minValue + i / ($scope.LEGEND_COLORS.length - 1) * (maxValue - minValue);
        });
        return d3.scale.linear().domain(domain).range($scope.LEGEND_COLORS);
    }

    function updateChart(point) {
        if (point) {
            var temporalData = $scope[$scope.tab + 'Data'];
            var data = temporalData.Data[point.i][point.j];
            $scope.chartData = {
                x: data.x,
                y: data.y,
                z: data.z,
                data: temporalData.withTimeSteps(data.values)
            };
        } else {
            $scope.chartData = null;
        }
    }

    function animate() {
        animationHandlers.forEach(function(handler) {
            handler(Time.tIndex);
        });
    }
});
