var gutil = require('gulp-util');
var through = require('through2');

module.exports = function (moduleName, dependencies) {
    return through.obj(function (file, enc, cb) {

        console.log("Compiling module: " + moduleName);

        var extendsAddition =
            `var __extends = (this && this.__extends) || (function () {
var extendStatics = Object.setPrototypeOf ||
    ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
    function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
return function (d, b) {
    extendStatics(d, b);
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
})();
`;

        var decorateAddition =
            'var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {\n' +
            'var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;\n' +
            'if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);\n' +
            'else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;\n' +
            'return c > 3 && r && Object.defineProperty(target, key, r), r;\n' +
            '};\n';

        let content = file.contents.toString();
        if (content.indexOf('__extends') === -1 && dependencies.length < 2) {
            extendsAddition = '';
        }

        if (content.indexOf('__decorate') === -1) {
            decorateAddition = '';
        }

        let dependenciesText = `${extendsAddition}
${decorateAddition}
if(typeof require !== 'undefined'){
    var globalObject = (typeof global !== 'undefined') ? global : ((typeof window !== 'undefined') ? window : this);
    var BABYLON = globalObject["BABYLON"] || {}; 
`;
        if (dependencies) {
            /*if (dependencies.length > 1) {
                dependenciesText += 'function nse(ns1, ns2) { Object.keys(ns2).forEach(function(c) {if(!ns1[c]) {ns1[c] = ns2[c]}}) };\n';
            }*/

            dependencies.forEach(function (d, idx) {
                dependenciesText += `var BABYLON${idx} = require('babylonjs/${d}');
`;
                dependenciesText += `if(BABYLON !== BABYLON${idx}) __extends(BABYLON, BABYLON${idx});
`;
            });
        }



        let exportRegex = /BABYLON.([0-9A-Za-z-_]*) = .*;\n/g

        var match = exportRegex.exec(content);

        let exportsArray = [];
        while (match != null) {
            if (match[1]) {
                exportsArray.push(match[1])
            }
            match = exportRegex.exec(content);
        }

        let exportsText = '';
        if (moduleName === "core") {
            exportsText = `(function() {
    globalObject["BABYLON"] = globalObject["BABYLON"] || BABYLON;
    module.exports = BABYLON; 
})();
}`
        }
        else {
            exportsText = `(function() {
var EXPORTS = {};`
            exportsArray.forEach(e => {
                if (e.indexOf('.') === -1)
                    exportsText += `EXPORTS['${e}'] = BABYLON['${e}'];`
            });

            exportsText += `
    globalObject["BABYLON"] = globalObject["BABYLON"] || BABYLON;
    module.exports = EXPORTS;
    })();
}`
        }

        if (file.isNull()) {
            cb(null, file);
            return;
        }

        if (file.isStream()) {
            //streams not supported, no need for now.
            return;
        }

        try {
            file.contents = new Buffer(dependenciesText.concat(new Buffer(String(file.contents).concat(exportsText))));
            this.push(file);
        } catch (err) {
            this.emit('error', new gutil.PluginError('gulp-add-babylon-module', err, { fileName: file.path }));
        }
        cb();
    });
}