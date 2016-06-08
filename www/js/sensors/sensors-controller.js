angular.module('starter.sensors')
    .controller('SensorsCtrl', SensorsCtrl);

SensorsCtrl.$inject = ['$interval', '$rootScope', 'sensorsService', 'speedLimitsService', 'maintenanceService'];
function SensorsCtrl($interval, $rootScope, sensorsService, speedLimitsService, maintenanceService) {

    if (!$rootScope.sensorsInitialized) {
        $rootScope.sensorsInitialized = true;
        $rootScope.loaded = false;

        $rootScope.coordinates = {
            latitude: undefined,
            longitude: undefined,
            altitude: undefined
        };
        $rootScope.speed = undefined;
        $rootScope.acceleration = {
            x: undefined,
            y: undefined,
            z: undefined
        };
        $rootScope.accuracy = undefined;

        $rootScope.points = 0;
        $rootScope.speedProgress = 50;
        $rootScope.brakingProgress = 50;
        $rootScope.accelerationProgress = 50;
        $rootScope.distance = 0;

        $rootScope.temperature = undefined;
        $rootScope.pressure = undefined;
        $rootScope.humidity = undefined;
        $rootScope.windSpeed = undefined;

        $rootScope.speedLimit = undefined;
        // DEMO
        // $rootScope.speedLimit = 13.8;
    }

    var pointsUpdateThreshold = 100;

    var speedLimitIncrement = 1;
    var speedLimitDecrement = 10;

    var accelerationSpeedThreshold = 5;
    var accelerationIntensityThreshold = -2;
    var accelerationIncrement = 0.1
    var accelerationDecrement = 1.0;

    var brakingSpeedThreshold = 5;
    var brakingIntensityThreshold = 5;
    var brakingIncrement = 0.1;
    var brakingDecrement = 1.0;

    var overrideSpeedLimit = false;
    var speedLimitOverride = 50.0;

    initialize();

    function initialize() {
        registerPositionListener();
        registerAccelerationListener();
        registerWeatherListener();
        registerSpeedLimitListener();
        $rootScope.loaded = true;
    }

    function registerPositionListener() {
        navigator.geolocation.watchPosition(
            onPositionUpdate,
            onPositionError, {
                enableHighAccuracy: true
            });
    }

    function registerAccelerationListener() {
        if (undefined === window.DeviceMotionEvent) {
            console.error('Device motion not supported :(');
            throw new Error('Device motion not supported :(');
        }
        window.addEventListener('devicemotion', onAccelerationUpdate, true);
    }

    function registerWeatherListener() {
        $interval(updateWeather, 60 * 1000);
    }

    function registerSpeedLimitListener() {
        $interval(updateSpeedLimit, 30 * 1000);
    }

    function onPositionError(err) {
        console.error('Failed to retrieve position', err);
    }

    function onPositionUpdate(position) {
        var positionUndefined = undefined === $rootScope.coordinates.latitude;
        if (!positionUndefined) {
            var dist = distance($rootScope.coordinates.latitude, $rootScope.coordinates.longitude, position.coords.latitude, position.coords.longitude);
            console.log(dist);
            if ($rootScope.distance % pointsUpdateThreshold < pointsUpdateThreshold && ($rootScope.distance % pointsUpdateThreshold) + dist >= pointsUpdateThreshold) {
                var points = ((($rootScope.distance % pointsUpdateThreshold) + dist) / pointsUpdateThreshold) | 0;
                addPoints(points);
            }
            $rootScope.distance += dist;
        }
        $rootScope.coordinates.latitude = position.coords.latitude;
        $rootScope.coordinates.longitude = position.coords.longitude;
        $rootScope.coordinates.altitude = position.coords.altitude;
        $rootScope.speed = position.coords.speed;
        $rootScope.accuracy = position.coords.accuracy;
        updateSpeedProgress();
        if (positionUndefined) {
            updateSpeedLimit();
        }
    }

    function onAccelerationUpdate(event) {
        var acceleration = event.acceleration;
        if (null === acceleration.x) {
            acceleration = event.accelerationIncludingGravity;
        }
        $rootScope.acceleration.x = acceleration.x;
        $rootScope.acceleration.y = acceleration.y;
        $rootScope.acceleration.z = acceleration.z;
        updateBrakingProgress();
        updateAccelerationProgress();
    }

    function updateWeather() {
        sensorsService.getWeatherConditions($rootScope.coordinates)
            .then(function (weather) {
                $rootScope.temperature = weather.data.main.temp;
                $rootScope.pressure = weather.data.main.pressure;
                $rootScope.humidity = weather.data.main.humidity;
                $rootScope.windSpeed = weather.data.wind.speed;
            });
    }

    function updateSpeedLimit() {
        speedLimitsService.getSpeedLimitAtPosition($rootScope.coordinates, $rootScope.accuracy)
            .then(function (speedLimit) {
                if (overrideSpeedLimit) {
                    $rootScope.speedLimit = speedLimitOverride;
                    return;
                }
                $rootScope.speedLimit = undefined !== speedLimit ? speedLimit / 3.6 : undefined;
            });
    }

    function distance(lat0, long0, lat1, long1) {
        var r = 6371000; // earth radius
        var phi0 = lat0 / 180 * Math.PI;
        var phi1 = lat1 / 180 * Math.PI;
        var lambda0 = long0 / 180 * Math.PI;
        var lambda1 = long1 / 180 * Math.PI;
        var deltaPhi = phi1 - phi0;
        var deltaLambda = lambda1 - lambda0;
        var a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi0) * Math.cos(phi1) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return r * c;
    }

    function addPoints(points) {
        console.log('Add points', points);
        if ($rootScope.speedProgress >= 80 && $rootScope.brakingProgress >= 80 && $rootScope.accelerationProgress >= 80) {
            $rootScope.points += 2 * points;
        } else {
            $rootScope.points += points;
        }
        $rootScope.$apply();
    }

    function updateSpeedProgress() {
        if (undefined === $rootScope.speedLimit) {
            //$rootScope.speedProgress += 0.5;
            return;
        }
        if (undefined !== $rootScope.speedLimit) {
            if ($rootScope.speed < $rootScope.speedLimit) {
                $rootScope.speedProgress += speedLimitIncrement;
            } else {
                $rootScope.speedProgress -= speedLimitDecrement;
            }
        }
        if ($rootScope.speedProgress < 0) {
            $rootScope.speedProgress = 0;
        } else if ($rootScope.speedProgress > 100) {
            $rootScope.speedProgress = 100;
        }
        $rootScope.$apply();
    }

    function updateBrakingProgress() {
        if ($rootScope.speed > brakingSpeedThreshold / 3.6) {
            if ($rootScope.acceleration.z <= brakingIntensityThreshold) {
                $rootScope.brakingProgress += brakingIncrement;
            } else {
                $rootScope.brakingProgress -= brakingDecrement;
            }
        }
        if ($rootScope.brakingProgress < 0) {
            $rootScope.brakingProgress = 0;
        } else if ($rootScope.brakingProgress > 100) {
            $rootScope.brakingProgress = 100;
        }
        $rootScope.$apply();
    }

    function updateAccelerationProgress() {
        if ($rootScope.speed > accelerationSpeedThreshold / 3.6) {
            if ($rootScope.acceleration.z >= accelerationIntensityThreshold) {
                $rootScope.accelerationProgress += accelerationIncrement;
            } else {
                $rootScope.accelerationProgress -= accelerationDecrement;
            }
        }
        if ($rootScope.accelerationProgress < 0) {
            $rootScope.accelerationProgress = 0;
        } else if ($rootScope.accelerationProgress > 100) {
            $rootScope.accelerationProgress = 100;
        }
        $rootScope.$apply();
    }
}
// z positif desceleration
// 6 = freinage brutal
// seil vitesse frainage 
// acc oppose freinage
// seuil freinage superiieur
// seuil 6-7
// increment trop rapide.