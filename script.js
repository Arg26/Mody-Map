// --- Global variable to hold location data ---
let locations = [];

// --- Map Layers ---
var streetLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
});

var satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, et al.'
});

// --- Map Initialization ---
var map = L.map('map', {
    center: [27.801564, 75.036523], // Campus Center
    zoom: 16,
    layers: [streetLayer] // Default layer
});

// --- Layer Control ---
var baseMaps = { "Street View": streetLayer, "Satellite View": satelliteLayer };
L.control.layers(baseMaps).addTo(map);

// --- Custom Control for Sidebar Toggle ---
L.Control.SidebarToggle = L.Control.extend({
    options: {
        position: 'topleft'
    },

    onAdd: function (map) {
        var container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
        container.style.backgroundColor = 'white';
        container.style.display = 'flex';
        container.style.flexDirection = 'column'; // Stack buttons
        
        // --- [CODE FIX] ---
        // This line allows the container's width to grow to fit the text
        container.style.width = 'auto';
        // --- [END FIX] ---

        // --- [CHANGED] Emojis removed ---
        this._routeButton = this._createButton(
            'Find Route', // Emoji removed!
            'Find Route', 
            container, 
            () => openSidebar('route')
        );

        // --- THIS IS THE CORRECTED LINE ---
        this._searchButton = this._createButton(
            'Search Directory', // Text changed from 'Search'
            'Search Directory', 
            container, 
            () => openSidebar('search')
        );
        
        // Stop map clicks from propagating
        L.DomEvent.disableClickPropagation(container);
        return container;
    },

    // Added className parameter to _createButton
    _createButton: function (content, title, container, fn, className = '') {
        var link = L.DomUtil.create('a', 'leaflet-control-sidebar-button', container);
        link.innerHTML = content;
        link.href = '#';
        link.title = title;
        if (className) {
            L.DomUtil.addClass(link, className);
        }
        
        L.DomEvent.on(link, 'click', L.DomEvent.stop)
            .on(link, 'click', fn, this);
        return link;
    }
});

// Add the new control to the map
new L.Control.SidebarToggle().addTo(map);

// --- Functions to control the new sidebar ---
function openSidebar(view) {
    closePanel(); // Close right info panel
    toggleView(view); // Set the content (route/search)
    document.querySelector('.left-panel').classList.add('visible');
}

function closeSidebar() {
    document.querySelector('.left-panel').classList.remove('visible');
}

// --- Fetch data and initialize the application ---
document.addEventListener('DOMContentLoaded', function() {
    
    // Set up Login/Logout button
    setupAuthUI(); 

    fetch('ModyData.json') 
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok. Status: ' + response.status);
            }
            return response.json();
        })
        .then(data => {
            locations = data;
            populateDatalist();
            populateCategoryDirectory();

            // --- [NEW LOGIC ADDED HERE] ---
            // Check if we need to return to a specific location after login
            const returnTo = sessionStorage.getItem('returnToLocationName');
            if (returnTo) {
                // 1. Clear the item so it doesn't trigger again on refresh
                sessionStorage.removeItem('returnToLocationName');
                
                // 2. Call the new core function to show the details
                showLocationDetails(returnTo);
            }
            // --- [END NEW LOGIC] ---

        })
        .catch(error => {
            console.error('Error fetching location data:', error);
            alert('Could not load location data. Please make sure ModyData.json is in the correct folder.');
        });
    
    toggleView('search');
});

// --- Populate Datalist for Search Autocomplete ---
function populateDatalist() {
    const placesDatalist = document.getElementById('places');
    placesDatalist.innerHTML = ''; 
    
    const myLocationOption = document.createElement('option');
    myLocationOption.value = 'My Location';
    placesDatalist.appendChild(myLocationOption);

    locations.forEach(location => {
        const option = document.createElement('option');
        option.value = location.NAME.trim();
        placesDatalist.appendChild(option);
    });
}

// --- Populate Category Directory ---
function populateCategoryDirectory() {
    const directoryContainer = document.getElementById('map-links-directory');
    directoryContainer.innerHTML = ''; 

    const categories = [...new Set(locations.map(loc => loc.CATEGORY))];
    categories.sort();

    categories.forEach(category => {
        const linkItem = document.createElement('div');
        linkItem.className = 'link-item';
        
        // *** [CHANGED] Replaced -> with ... ***
        linkItem.innerHTML = `${category} <span class="arrow">...</span>`;
        
        linkItem.onclick = () => showCategoryOnMap(category);
        directoryContainer.appendChild(linkItem);
    });
}

// --- Global Map State Variables ---
var routingControl = null;
var searchMarker = null;
var userLocationMarker = null; 
var locationWatchId = null; 
var categoryMarkersGroup = L.layerGroup().addTo(map);
let lastRouteUpdateTime = 0; 

// --- Define a WALKING router ---
var walkingRouter = L.Routing.osrmv1({
    serviceUrl: 'https://router.project-osrm.org/route/v1',
    profile: 'walking'
});

// --- Global GPS Options ---
const geolocationOptions = {
    enableHighAccuracy: true,
    maximumAge: 10000, 
    timeout: 20000     
};

// --- Toggle for live location marker ---
function toggleLiveLocation() {
    const btn = document.getElementById('location-btn');
    
    if (locationWatchId) {
        clearMap(); 
    } else {
        clearMap(); 
        
        if (!navigator.geolocation) {
            alert("Geolocation is not supported by your browser.");
            return;
        }
        
        btn.innerHTML = 'X'; 
        btn.title = 'Stop Tracking';
        btn.classList.add('active');

        locationWatchId = navigator.geolocation.watchPosition(
            (position) => {
                console.log("Live location fix:", position.coords);
                const userLatLng = L.latLng(position.coords.latitude, position.coords.longitude);

                if (!userLocationMarker) {
                    userLocationMarker = L.circleMarker(userLatLng, {
                        radius: 8, fillColor: "#1E90FF", color: "#000",
                        weight: 1, opacity: 1, fillOpacity: 0.8
                    }).addTo(map).bindPopup("Your Location");
                    map.setView(userLatLng, 18);
                } else {
                    userLocationMarker.setLatLng(userLatLng);
                }
            },
            (error) => {
                console.error(`Error getting location: ${error.message}`);
                alert(`Error getting your location: ${error.message}`);
                clearMap(); 
            },
            geolocationOptions
        );
    }
}

// --- This function now just toggles panel content ---
function toggleView(view) {
    const routeContainer = document.getElementById('route-container');
    const searchContainer = document.getElementById('search-container');
    const mapLinks = document.getElementById('map-links-directory');
    
    clearMap(); 

    if (view === 'route') {
        routeContainer.style.display = 'flex';
        searchContainer.style.display = 'none';
        mapLinks.style.display = 'none';
    } else if (view === 'search') {
        routeContainer.style.display = 'none';
        searchContainer.style.display = 'flex';
        mapLinks.style.display = 'block'; 
    }
}

// --- [MODIFIED] Search for a single place (This function is now just a trigger) ---
function searchPlace(inputId) {
    const searchName = document.getElementById(inputId).value.trim();
    if (!searchName) {
        alert("Please enter a location to search for.");
        return;
    }
    // Call the new core function
    showLocationDetails(searchName);
}

// --- [NEW] Core function to show location details (reusable) ---
function showLocationDetails(searchName) {
    if (!searchName) return; 

    const location = locations.find(loc => loc.NAME.trim().toLowerCase() === searchName.trim().toLowerCase());

    if (location) {
        clearMap(); // Clear map *before* adding new marker

        const latLng = [location.LATITUDE, location.LONGITUDE];
        searchMarker = L.marker(latLng).addTo(map)
            .bindPopup(`<b>${location.NAME}</b>`)
            .openPopup();
        
        map.setView(latLng, 18);

        const infoContent = document.getElementById('info-content');
        
        let imageHtml = '';
        if (location.IMAGE_URL && location.IMAGE_URL.trim() !== '') {
            imageHtml = `<img src="${location.IMAGE_URL}" alt="Image of ${location.NAME}" class="info-panel-image">`;
        }

        // Dynamically create the contact info block based on login status
        let contactHtml = '';
        const isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';

        if (isLoggedIn) {
            // --- [LOGIC UPDATED FOR NEW JSON DATA] ---
            
            // 1. Handle Phone Number (CONTACTS)
            if (location.CONTACTS && location.CONTACTS !== 'NIL') {
                contactHtml += `<p><b>Phone:</b> ${location.CONTACTS}</p>`;
            }

            // 2. Handle Emails (Check if string or object)
            if (location.EMAIL && location.EMAIL !== 'NIL') {
                if (typeof location.EMAIL === 'object') {
                    // It is a list of emails (e.g., ABB building)
                    contactHtml += `<b>Department Emails:</b><br><ul style="margin-top:5px; padding-left:20px; margin-bottom:10px;">`;
                    for (const [dept, email] of Object.entries(location.EMAIL)) {
                        contactHtml += `<li><b>${dept}:</b> <a href="mailto:${email}">${email}</a></li>`;
                    }
                    contactHtml += `</ul>`;
                } else {
                    // It is a single string
                    contactHtml += `<p><b>Email:</b> <a href="mailto:${location.EMAIL}">${location.EMAIL}</a></p>`;
                }
            }
            
            // Fallback message if no contact info is present at all
            if (contactHtml === '') {
                contactHtml = '<p>No contact details available.</p>';
            }

        } else {
            // User is not logged in. Show the login link.
            const escapedName = location.NAME.replace(/'/g, "\\'"); // Escape quotes
            contactHtml = `<p><b><a href="#" onclick="redirectToLogin('${escapedName}')" style="color: #0078d7; text-decoration: none; font-weight: bold;">Login to view Phone & Email</a></b></p>`;
        }

        // Build the final HTML for the info panel
        infoContent.innerHTML = `
            ${imageHtml}
            <h2>${location.NAME}</h2>
            <p><b>Category:</b> ${location.CATEGORY}</p>
            <p><b>Description:</b> ${location.DESCRIPTION}</p>
            <p><b>Timings:</b> ${location.TIMING}</p>
            <hr style="border: 0; border-top: 1px solid #ccc; margin: 10px 0;">
            ${contactHtml}`;
        
        document.getElementById('info-panel').classList.add('visible');

        closeSidebar(); 
    } else {
        alert("Could not find the location: " + searchName);
    }
}

// --- Show all markers for a category ---
function showCategoryOnMap(categoryName) {
    clearMap();
    closeSidebar(); 
    
    const categoryLocations = locations.filter(loc => loc.CATEGORY === categoryName);

    if (categoryLocations.length === 0) return;

    categoryLocations.forEach(location => {
        const marker = L.marker([location.LATITUDE, location.LONGITUDE])
            .bindPopup(`<b>${location.NAME.trim()}</b>`);
        categoryMarkersGroup.addLayer(marker);
    });

    map.fitBounds(categoryMarkersGroup.getBounds().pad(0.1));
}

function closePanel() {
    document.getElementById('info-panel').classList.remove('visible');
}

// --- Routing with Live Tracking ---
function showRoute() {
    clearMap(); 
    let startName = document.getElementById('start').value.trim();
    let endName = document.getElementById('end').value.trim();

    if (!startName || !endName) {
        alert("Please enter both a start and end location!");
        return;
    }

    const endLocation = locations.find(loc => loc.NAME.trim().toLowerCase() === endName.toLowerCase());

    if (!endLocation) {
        alert("Invalid end location. Please select from the list.");
        return;
    }

    if (startName.toLowerCase() === 'my location') {
        if (navigator.geolocation) {

            const btn = document.getElementById('location-btn');
            btn.innerHTML = 'X'; 
            btn.title = 'Stop Tracking';
            btn.classList.add('active');

            locationWatchId = navigator.geolocation.watchPosition(
                (position) => {
                    console.log("Routing location fix:", position.coords);
                    
                    const userLatLng = L.latLng(position.coords.latitude, position.coords.longitude);
                    const endLatLng = L.latLng(endLocation.LATITUDE, endLocation.LONGITUDE);
                    const now = Date.now(); 

                    // 1. ALWAYS Update the Blue Dot
                    if (!userLocationMarker) {
                        userLocationMarker = L.circleMarker(userLatLng, {
                            radius: 8, fillColor: "#1E90FF", color: "#000",
                            weight: 1, opacity: 1, fillOpacity: 0.8
                        }).addTo(map).bindPopup("Your Location");
                    } else {
                        userLocationMarker.setLatLng(userLatLng);
                    }

                    // 2. DEBOUNCE the Route Calculation (every 5 seconds)
                    if (!routingControl || (now - lastRouteUpdateTime > 5000)) {
                        console.log("Requesting new route from server...");
                        lastRouteUpdateTime = now; 

                        if (!routingControl) {
                            routingControl = L.Routing.control({
                                waypoints: [userLatLng, endLatLng],
                                router: walkingRouter,
                                routeWhileDragging: false, 
                                
                                // *** [CHANGED] Show all routes ***
                                showAlternatives: true, 
                                
                                addWaypoints: false, 
                                draggableWaypoints: false,
                                fitSelectedRoutes: true
                            }).addTo(map);
                        } else {
                            routingControl.setWaypoints([userLatLng, endLatLng]);
                        }
                    }

                    // 3. ALWAYS Smart Pan
                    if (!map.getBounds().contains(userLatLng)) {
                        map.panTo(userLatLng);
                    }
                },
                (error) => { 
                    console.error(`Error getting location: ${error.message}`);
                    alert(`Error getting your location: ${error.message}\n\nThe map will try to reconnect.`); 
                },
                geolocationOptions
            );
        } else {
            alert("Geolocation is not supported by your browser.");
        }
    } else {
        // --- This runs if "My Location" is NOT the start point ---
        const startLocation = locations.find(loc => loc.NAME.trim().toLowerCase() === startName.toLowerCase());
        if (!startLocation) {
            alert("Invalid start location. Please select from the list.");
            return;
        }
        routingControl = L.Routing.control({
            waypoints: [
                L.latLng(startLocation.LATITUDE, startLocation.LONGITUDE),
                L.latLng(endLocation.LATITUDE, endLocation.LONGITUDE)
            ],
            router: walkingRouter, 
            routeWhileDragging: false, 
            
            // *** [CHANGED] Show all routes ***
            showAlternatives: true, 
            
            addWaypoints: false, 
            draggableWaypoints: false,
            fitSelectedRoutes: true
        }).addTo(map);
    }
    
    closeSidebar();
}

// --- Utility function to clear map state ---
function clearMap() {
    if (locationWatchId) {
        navigator.geolocation.clearWatch(locationWatchId);
        locationWatchId = null;
        console.log("Stopped location watch.");
    }

    const btn = document.getElementById('location-btn');
    
    // *** [CHANGED] Replaced [O] with LOC ***
    btn.innerHTML = 'LOC';
    
    btn.title = 'Show My Location';
    btn.classList.remove('active');

    if (routingControl) {
        map.removeControl(routingControl);
        routingControl = null;
    }
    if (searchMarker) {
        map.removeLayer(searchMarker);
        searchMarker = null;
    }
    if (userLocationMarker) {
        map.removeLayer(userLocationMarker);
        userLocationMarker = null;
    }
    categoryMarkersGroup.clearLayers();
    closePanel();
    closeSidebar(); 
}

// --- Functions for Login/Logout UI ---

/**
 * Checks session storage and adds the "Logout" button if logged in.
 * This runs when the page first loads.
 */
function setupAuthUI() {
    const authControls = document.getElementById('auth-controls');
    const isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true'; // <-- CORRECTED

    if (isLoggedIn) {
        authControls.innerHTML = `<button id="logout-btn" onclick="logout()" title="Logout">Logout</button>`;
    } else {
        authControls.innerHTML = ''; // No button if not logged in
    }
}

function logout() {
    sessionStorage.removeItem('isLoggedIn');
    sessionStorage.removeItem('returnToLocationName'); // Clear return-to link on logout
    alert('You have been logged out.');
    location.reload(); 
}

/**
 * [NEW] Saves the current location to session storage and redirects to login.
 */
function redirectToLogin(locationName) {
    sessionStorage.setItem('returnToLocationName', locationName);
    window.location.href = 'login.html'; // Assumes your login page is named this
}