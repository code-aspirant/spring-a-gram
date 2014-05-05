(function(define) { 'use strict';
    define(function(require) {

        require('css!jquery-mobile-bower/css/jquery.mobile-1.4.2.css');
        require('jquery-mobile-js');

        var $ = require('jquery');
        var rest = require('rest');
        var when = require('when');
        var defaultRequest = require('rest/interceptor/defaultRequest');
        var mime = require('rest/interceptor/mime');
        var hateoas = require('rest/interceptor/hateoas');
        var hal = require('rest/mime/type/application/hal');
        var registry = require('rest/mime/registry');

        var name, bytes, currentGallery;
        var api = rest
            .chain(mime)
            .chain(hateoas)
            .chain(defaultRequest, {headers: {'Accept': 'application/hal+json'}});
        var items = {};
        var galleries = {};
        var currentItem;

        /* Convert a single or array of resources into "URI1\nURI2\nURI3..." */
        var uriListConverter = {
            read: function(str, opts) {
                return str.split('\n');
            },
            write: function(obj, opts) {
                // If this is an Array, extract the self URI and then join using a newline
                if (obj instanceof Array) {
                    return obj.map(function(resource) {
                        return resource._links.self.href;
                    }).join('\n');
                } else { // otherwise, just return the self URI
                    return obj._links.self.href;
                }
            }
        };
        registry.register('text/uri-list', uriListConverter);
        registry.register('application/hal+json', hal);

        function readImage(input) {
            if (input.files && input.files[0]) {
                if (input.files[0].type.indexOf('image') != -1) {
                    var FR = new FileReader();
                    FR.onloadend = function () {
                        name = input.files[0].name;
                        bytes = FR.result;
                    }
                    FR.readAsDataURL(input.files[0]);
                }
            }
        }

        /* Take either a JSON or URI version of a resource, and extract it's ID */
        function id(resource) {
            if (typeof resource === "string") {
                var parts = resource.split("/");
            } else {
                var parts = resource._links.self.href.split("/");
            }
            return parts[parts.length - 1];
        }

        function follow(relArray) {
            var root = api({
                method: 'GET',
                path: '/'
            });
            relArray.forEach(function(rel) {
                root = root.then(function (response) {
                    if (response.entity._embedded && response.entity._embedded.hasOwnProperty(rel)) {
                        return response.entity[rel];
                    } else {
                        return response.entity.clientFor(rel)({});
                    }
                });
            });
            return root;
        }

        function addGalleryRow(gallery) {
            return api({
                method: 'GET',
                path: gallery._links.items.href
            }).then(function(response) {
                var collapsible = $('<div data-role="collapsible" data-mini="true" data-collapsed-icon="carat-d" data-expanded-icon="carat-u"></div>');

                collapsible.append(
                    $('<h4></h4>').text(gallery.description)
                );

                var collection = $('<ul data-role="listview"></ul>');

                if (response.entity._embedded) {
                    response.entity._embedded.items.forEach(function (item) {
                        var row = $('<li></li>').append(
                            $('<a href="#galleryOps" data-rel="popup" data-transition="flow"></a>').append(
                                $('<img />').attr('src', item.image)
                            )
                        )
                        collection.append(row);
                    });
                }
                collection.listview().enhanceWithin();
                collapsible.append(collection);
                collapsible.collapsible().enhanceWithin();

                return collapsible;
            });
        }

        /* When the page is loaded, run/register this set of code */
        function addItemRow(item) {
            var list = $('<li></li>').attr('data-uri', item._links.self.href);

            list.append(
                $('<a data-rel="popup" data-transition="fade" data-position-to="window"></a>')
                    .attr('href', '#view')
                    .append($('<img />').attr('src', item.image))
            );

            list.append($('<a href="#pic_ops" data-rel="popup" data-transition="flow" data-icon="gear"></a>'));

            return list;
        }

        $(function() {
            /* Listen for picking a file */
            $('#file').change(function () {
                readImage(this);
            });

            /* When upload is clicked, upload the file, store it, and then add to list of unlinked items */
            $('#upload').submit(function (e) {
                e.preventDefault();
                api({
                    method: 'POST',
                    path: '/items',
                    entity: {
                        name: name,
                        image: bytes
                    },
                    headers: {'Content-Type': 'application/json'}
                }).then(function(response) {
                    api({
                        method: 'GET',
                        path: response.headers.Location
                    }).then(function(response) {
                        var item = response.entity;
                        items[item._links.self.href] = item;
                        addItemRow(item);
                    });
                });
            });

            $('#piclist').on('click', function(e) {
                console.log(e);
                console.log(e.target);
                console.log(e.target.parentNode);
                if (e.target.tagName === 'IMG') {
                    currentItem = items[e.target.parentNode.parentNode.dataset['uri']];
                }
                if (e.target.tagName === 'A') {
                    currentItem = items[e.target.parentNode.dataset['uri']];
                }
                $('#view img').attr('src', currentItem.image);
            });

            $('#deleteConfirmed').on('click', function(e) {
                api({ method: 'DELETE', path: currentItem._links.self.href }).then(function(response) {
                    $('#piclist li[data-uri="' + currentItem._links.self.href + '"').remove();
                    delete items[currentItem._links.self.href];
                    currentItem = undefined;
                });
            })

            follow(['galleries', 'galleries']).then(function(response) {
                var gallerylist = $('#gallerylist');
                response.forEach(function(gallery) {
                    galleries[gallery._links.self.href] = gallery;
                    addGalleryRow(gallery).then(function(response) {
                        gallerylist.append(response);
                    })

                });
            });

            follow(['items', 'search', 'findByGalleryIsNull', 'items']).then(function(response) {
                var piclist = $('#piclist');
                response.forEach(function(item) {
                    items[item._links.self.href] = item;
                    piclist.append(addItemRow(item));
                });
                piclist.listview('refresh');
            });
        })

        return function() {

        }
    });
}(typeof define === 'function' && define.amd
        //assume metadata was requested by AMD
        ? define
        // otherwise, metadata is added to global springagram namespace
        : function() { if (!window.springagram) window.springagram = {}; window.springagram = foo(); }
));