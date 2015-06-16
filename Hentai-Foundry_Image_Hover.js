// ==UserScript==
// @name         Hentai Foundry - Image Hover
// @namespace    https://github.com/Kayla355
// @version      0.2
// @description  Fetches a larger version of the image upon hovering over a thumbnail.
// @author       Kayla355
// @match        www.hentai-foundry.com/*
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @icon         http://img.hentai-foundry.com/themes/Hentai/favicon.ico
// @require      http://code.jquery.com/jquery-2.1.3.min.js
// @require      https://raw.githubusercontent.com/customd/jquery-visible/master/jquery.visible.min.js
// @history      0.2 Fixed an issue with smartPreload not loading in the image correctly. Also fixed an issue with flash files.
// ==/UserScript==

// Options //
var imagePosition = "bottom-right"   // Default: bottom-right  || ´Options are: top-left, top-right, bottom-left, bottom-right
var hoverSize     = 512;             // Default: 512           ||  Size of the image that will show up in pixels.
//                        ||
var preloadAll    = false;           // Default: false         ||  Pre-load all images at once (Resource Heavy & slow, also won't load any images until finished pre-loading...)
var smartPreload  = true;            // Default: true          ||  Smart pre-load of images by loading only the currently visible elements.

// Styles //
GM_addStyle(".image-hover {"
            +"position: absolute;"
            +"z-index: 9999;"
            +"box-shadow: 5px 5px 10px 0px rgba(50, 50, 50, 0.75);"
            +"pointer-events: none;"
            +"}"

            +".image-hover img {"
            +"max-height: "+ hoverSize +"px;"
            +"max-width: "+ hoverSize +"px;"
            +"}"

            +".loader {"
            +"position: absolute;"
            +"margin: 8px 0px 0px 8px;"
            +"border-bottom: 6px solid rgba(255, 255, 255, 0.4);"
            +"border-left: 6px solid rgba(255, 255, 255, 0.4);"
            +"border-right: 6px solid rgba(255, 255, 255, 0.4);"
            +"border-top: 6px solid rgba(0, 0, 0, 0.8);"
            +"border-radius: 100%;"
            +"height: 25px;"
            +"width: 25px;"
            +"animation: rot 0.6s infinite linear;"
            +"}"
            +"@keyframes rot {"
            +"from {transform: rotate(0deg);}"
            +"to {transform: rotate(359deg);}"
            +"}"

            +"#pl-background {"
            +"position: absolute;"
            +"background-color: white;"
            +"height: 20px;"
            +"width: 125px;"
            +"border-radius: 25px;"
            +"}"

            +"#pl-fill {"
            +"display: inline-block;"
            +"background-color: red;"
            +"height: 20px;"
            +"border-radius: 25px;"
            +"}"

            +"#pl-background center {"
            +"position: absolute;"
            +"top: 0px;"
            +"left: 0px;"
            +"width: 125px;"
            +"text-align: center;"
            +"font-size: 10px;"
            +"font-weight: 900;"
            +"line-height: 20px;"
            +"}");

// Variables //
var hovering         = false;
var mouse            = {X: 0, Y: 0}
var imageExt         = [".jpg", ".jpeg", ".png", ".gif"];
var loaded           = {};
var plProgress       = {current: 0, total: 0, percent: "0%"};
var loadingStatus    = "inactive";
// Timers
var hoverTimer;
var hoverTimerStart;
var scrollTimer;

// Code //

// Event Listeners //

// Start preloading images
if(preloadAll || smartPreload) {
    if(preloadAll) {
        smartPreload = false;
    }
    loadImages();
}

// Listen for Events on thumbnails
$("img.thumb").on({
    mousemove: function(e) {
        // Get mouse location
        if(e.pageY && e.pageX) {
            mouse.Y = e.pageY + 2;
            mouse.X = e.pageX + 5;
        }

        // Run function to keep image inside of window.
        if(hovering) {
            keepInside();
        }
        //console.log("X: "+ e.pageX +", Y: "+ e.pageY);
    },
    mouseenter: function(e) {
        // Create links, id, etc.
        var link = e.target.parentNode.href.match(/(http:\/\/www.hentai-foundry.com\/pictures\/user)(\/.*\/)/)[2];
        var id   = link.match(/(?:\/.*\/)(.*)(?:\/)/)[1];
        var cat  = link.slice(1, 2).toLowerCase();
        if(cat.match(/-/)) {
            cat = "_";
        } else if(cat.match(/[^a-z]/)) {
            cat = "0";
        }
        var src = "http://pictures.hentai-foundry.com/" + cat + "/" + link.slice(0, -1);
        var obj = {id: id, src: src, target: e.target, from: "hover"};

        // Create content div
        $('<div class="image-hover">'
          +'<div id="hoverLoader" class="loader"></div>'
          +'<div id="'+ id +'" style="display:none"></div>'
          +'</div>').appendTo("body");

        // Check if user has recently hovered over an object, thereby triggering the hover mode.
        if(!hovering) {
            clearTimeout(hoverTimerStart);
            hoverTimerStart = setTimeout(function() {
                hovering = true;
                hoverFunc(obj);
            }, 500);
        } else {
            hoverFunc(obj);
        }
        // Clear timer to exit "hovermode"
        clearTimeout(hoverTimer);
    },
    mouseleave: function(e) {
        // Clear timeouts and remove divs.
        clearTimeout(hoverTimerStart);
        $("div.image-hover").remove();
        hoverTimer = setTimeout(function() { hovering = false; }, 500);
    }
});

// If smartPreload is enabled, Listen for when the document is scrolled
if(smartPreload) {
    $(document).on('scroll', function() {
        console.log("Scrolled, loading is", loadingStatus);
        if(preloadAll || smartPreload) {
            clearTimeout(scrollTimer);
            scrollTimer = setTimeout(function() {
                if(loadingStatus === "active") {
                    $(document).on("stoppedLoading", function() {
                        console.log("stopped loading, starting again");
                        loadImages();
                    });
                } else {
                    loadImages();
                }
            }, 1000);
        }
    });
}

// Listen for update to the pre-load progress.
$(document).on("plStatusChange", function() {
    $('.image-hover div div').css({width: plProgress.percent + "%"});
    $('.image-hover div center').text(plProgress.current+"/"+plProgress.total+" ("+plProgress.percent+"%)");

    if(plProgress.total !== 0) {
        console.log("Pre-load Progress:", plProgress.current, "/", plProgress.total);
        if(plProgress.current === plProgress.total) {
            console.log("Finished Pre-loading all Images.");
            plProgress.current = 0;
            plProgress.total   = 0;
        }
    }
});

// Re-usable Functions //

// Function that is run when hovering over an image.
function hoverFunc(obj) {
    var target = obj.target;
    var id     = obj.id;

    $('#'+id).on("imageLoaded", function() {
        $('#hoverLoader').remove();
        $('.image-hover div#'+ obj.id).css("background-color", "#a3a3ab").append(loaded[id].image).show();
        $(obj.target).trigger("mousemove");
    });

    $(target).trigger("mousemove");
    if(plProgress.current != plProgress.total) {
        $('#hoverLoader').remove();
        $('.image-hover').append('<div id="pl-background"><div id="pl-fill"></div><center></center></div>');
    } else if (loaded[id]) {
        if(loaded[id].status === "done") {
            loaded[id].from = "hover";
            createImages(loaded[id]);
        }
    } else {
        imageExt.eachImage(obj);
    }

    $(document).trigger("plStatusChange");
}

// Function for creating and loading the images before showing.
function loadImages() {
    var thumbs = $('img.thumb');
    var from   = "preload";
    loadingStatus = "active";
    done = 1;

    if(smartPreload) {
        from = "smartload";
        console.log("Filtering!");
        thumbs = $('img.thumb').filter(function(e) {
            var id = this.src.match(/(?:pid=)([0-9]*)/)[1];
            if($(this).visible( true )) {
                if(loaded[id]) {
                    if(loaded[id].image) {
                        console.info("["+id+"]", "Image already loaded:", loaded[id].image.src);
                    }
                    return false;
                }
                //console.log("Visible:",$(this).visible( true ));
                return true;
            } else {
                //console.log("Visible:", $(this).visible( true ), "Loaded:", loaded[id]);
                return false;
            }
        });
    }

    thumbs.each(function(i) {
        var e = {target: this}
        var link = e.target.parentNode.href.match(/(http:\/\/www.hentai-foundry.com\/pictures\/user)(\/.*\/)/)[2];
        var id   = link.match(/(?:\/.*\/)(.*)(?:\/)/)[1];
        var cat  = link.slice(1, 2).toLowerCase();

        if(cat.match(/-/)) {
            cat = "_";
        } else if(cat.match(/[^a-z]/)) {
            cat = "0";
        }
        var imgSrc = "http://pictures.hentai-foundry.com/" + cat + "/" + link.slice(0, -1);

        loaded[id] = {};
        
        var fail = 0;

        imageExt.forEach(function(ext) {
            imageExists(imgSrc + ext, function(exists) {
                if(exists) {

                    loaded[id].id      = id;
                    loaded[id].src     = imgSrc;
                    loaded[id].ext     = ext;
                    loaded[id].target  = e.target;
                    loaded[id].from    = from;

                    if(loaded[id].ext && from === "preload") {
                        plProgress.realtotal++;
                        //return;
                    }

                    createImages(loaded[id], thumbs.length);
                } else {
                fail++;
                if(fail === imageExt.length) {
                    console.log("Loading Progress: ", done +" / "+ thumbs.length);
                    done++;
                    loaded[id].ext = "failed";
                    console.error("Could not determine file type:", imgSrc);
                }
            }
            });
        });
    });
}


// Create the image and load it before attaching it to the div.
function createImages(obj, total) {
    var image = new Image();

    if(obj.from === "preload") {
        plProgress.total = total;
        if(plProgress.realtotal > plProgress.total && obj.from === "preload") {
            plProgress.total = plProgress.realtotal;
        }
    }


    if(obj.status === "done") {
        if(loaded[obj.id].image) {
            if($('#'+obj.id+' img').length === 0) {
                $('#'+obj.id).trigger("imageLoaded");
            }
            return;
        }
    }

    if(obj.from != "preload" && obj.status !== "done") {
        image.onload = function () {
            obj.image = image;
            if($('#'+obj.id+' img').length === 0) {
                obj.status = "done";

                if(obj.from === "smartload") {
                    loaded[obj.id].status = obj.status;
                    loaded[obj.id].image = image;
                } else {
                    loaded[obj.id] = obj;
                }

                console.info("["+obj.id+"]", "Image loaded:", obj.image.src);
                $('#'+obj.id).trigger("imageLoaded");
            }
            console.log("Loading Progress: ", done +" / "+ total);
            done++;
            if(done === total) {
                console.log("Finished loading images");
                loadingStatus = "inactive";
                $(document).trigger("loadingStopped");
            }
        }
    } else if(obj.from === "preload") {
        image.onload = function () {
            plProgress = {current: plProgress.current+1, total: plProgress.total, percent: Math.round((plProgress.current / plProgress.total) * 100)}; 
            $(document).trigger("plStatusChange");
        }
    }

    image.onerror = function () {
        obj.status = "failed";
        console.error("Cannot load image");
    }

    obj.status = "loading";
    image.src = obj.src + obj.ext;
}

// Prototype for checking each of the image extensions listed in 'imageExt'.
Array.prototype.eachImage = function(obj) {
    var fail = 0;
    this.forEach(function(ext) {
        imageExists(obj.src + ext, function(exists) {
            if(exists) {
                obj.ext = ext;
                createImages(obj);
            } else {
                fail++;
                console.log(imageExt.length);
                if(fail === imageExt.length) {
                
                }
            }
        });
    });
}

// Checks if the given image url exists
function imageExists(url, callback) {
    GM_xmlhttpRequest({
        url: url,
        method: "HEAD",
        onload: function(response) {
            callback(response.status < 400);
        }
    });
}

// Function for keeping the image inside the window borders.
function keepInside() {
    var image = {};
    try {
        image  = {
            naturalHeight: $('.image-hover img')[0].height,
            naturalWidth:  $('.image-hover img')[0].width
        };
    } catch(e) {
        image  = {
            naturalHeight: 0,
            naturalWidth:  0
        };
    }

    var screen = {
        height: window.pageYOffset + $(window).height() - 2,
        width:  window.pageXOffset + $(window).width()  - 0,
        naturalHeight: $(window).height(),
        naturalWidth:  $(window).width()
    };

    // Get image height, relative to mouse position.
    try {
        if(imagePosition === "bottom-left" || imagePosition === "bottom-right") {
            image.height = (mouse.Y - 2) + image.naturalHeight;
        } else {
            image.height = (mouse.Y - 2) - image.naturalHeight;
        }
    } catch(e) {
        image.height = 0;
    }

    // Get image width, relative to mouse position.
    try {
        if(imagePosition === "top-right" || imagePosition === "bottom-right") {
            image.width = (mouse.X + 2) + image.naturalWidth;
        } else {
            image.width = (mouse.X + 2) - image.naturalWidth;
        }
    } catch(e) {
        image.width = 0;
    }

    // Check if image is outside of screen
    if(imagePosition === "bottom-left" || imagePosition === "bottom-right") {
        if(screen.height <= image.height) {
            mouse.Y = mouse.Y - (image.height - screen.height);
        }
    } else {
        if(image.height + screen.naturalHeight - 1<= screen.height) {
            mouse.Y = mouse.Y - image.height + (screen.height - screen.naturalHeight) + 1;
        }
    }

    // Check if image is outside of screen
    if(imagePosition === "top-right" || imagePosition === "bottom-right") {
        if(screen.width <= image.width) {
            mouse.X = mouse.X - (image.width - screen.width);
        }
    } else {
        if (image.width <= 3){
            mouse.X = mouse.X + ~image.width + 5;
        }
    }

    // Offset depending image position relative to mouse set in options
    switch(imagePosition) {
        case "top-left": 
            image.Y = mouse.Y - (image.naturalHeight);
            image.X = mouse.X - (image.naturalWidth);
            break;
        case "top-right":
            image.Y = mouse.Y - (image.naturalHeight);
            image.X = mouse.X;
            break;
        case "bottom-left":
            image.Y = mouse.Y;
            image.X = mouse.X - (image.naturalWidth);
            break;
        default:
            image.Y = mouse.Y;
            image.X = mouse.X;
            break;

    }

    // Set image position
    $("div.image-hover").css({
        "top": image.Y,
        "left": image.X
    });
}