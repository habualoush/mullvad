// DOM elements
const findClosestBtn = document.getElementById('findClosestBtn');
const showAllBtn = document.getElementById('showAllBtn');
const statusDiv = document.getElementById('status');
const closestServerDiv = document.getElementById('closestServer');
const serversListDiv = document.getElementById('serversList');
const sortControlsDiv = document.getElementById('sortControls');
const sortSelect = document.getElementById('sortSelect');

let userLocation = null;
let allServers = [];
let allCities = [];
let currentSortBy = 'country';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Don't preload - load on demand
    console.log('Mullvad Server Finder ready');
});

// Find closest server button handler
findClosestBtn.addEventListener('click', () => {
    if (!navigator.geolocation) {
        showStatus('Geolocation is not supported by your browser', 'error');
        return;
    }

    showStatus('Getting your location...', 'info');
    findClosestBtn.disabled = true;

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            userLocation = {
                lat: position.coords.latitude,
                lon: position.coords.longitude
            };

            try {
                showStatus('Finding best servers... Testing top candidates by latency...', 'info');
                
                const response = await fetch(`/api/closest?lat=${userLocation.lat}&lon=${userLocation.lon}`);
                const topServers = await response.json();

                if (topServers.error) {
                    showStatus(topServers.error, 'error');
                    findClosestBtn.disabled = false;
                    return;
                }

                displayTopServers(topServers);
                serversListDiv.innerHTML = ''; // Clear the servers list
                showStatus('Top 5 servers found based on actual network latency!', 'success');
                setTimeout(() => statusDiv.style.display = 'none', 5000);
            } catch (error) {
                showStatus('Error finding closest servers: ' + error.message, 'error');
            } finally {
                findClosestBtn.disabled = false;
            }
        },
        (error) => {
            let errorMessage = 'Error getting location: ';
            switch (error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage += 'Permission denied. Please allow location access.';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage += 'Location information unavailable.';
                    break;
                case error.TIMEOUT:
                    errorMessage += 'Location request timed out.';
                    break;
                default:
                    errorMessage += 'Unknown error.';
                    break;
            }
            showStatus(errorMessage, 'error');
            findClosestBtn.disabled = false;
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
});

// Show all servers button handler
showAllBtn.addEventListener('click', async () => {
    showStatus('Loading all servers...', 'info');
    await displayAllServers();
    closestServerDiv.classList.remove('show');
    sortControlsDiv.style.display = 'block';
    showStatus('Servers loaded successfully!', 'success');
    setTimeout(() => statusDiv.style.display = 'none', 2000);
});

// Sort dropdown handler
sortSelect.addEventListener('change', (e) => {
    currentSortBy = e.target.value;
    renderCities(allCities);
});

// Display top 5 closest servers
function displayTopServers(servers) {
    closestServerDiv.innerHTML = `
        <h2>Top 5 Fastest Servers for You</h2>
        <p style="color: #b8c9d9; margin-bottom: 25px; font-size: 0.95em;">Ranked by actual network latency</p>
    `;
    
    servers.forEach((server, index) => {
        const ownershipBadge = server.owned ? '<span style="background: #ffcd00; color: #192e45; padding: 2px 8px; border-radius: 3px; font-size: 0.7em; margin-left: 10px;">OWNED</span>' : '';
        const rankBadge = index === 0 ? '🏆' : `#${index + 1}`;
        const latencyColor = server.tcpLatency ? (server.tcpLatency < 50 ? '#69db7c' : server.tcpLatency < 100 ? '#ffcd00' : '#ff9d6b') : '#8195a5';
        
        const serverCard = document.createElement('div');
        serverCard.style.cssText = `
            background: #1d3a54;
            border-left: 4px solid ${index === 0 ? '#ffcd00' : '#2d4f6c'};
            padding: 20px;
            margin-bottom: 15px;
            border-radius: 8px;
        `;
        
        serverCard.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                <div>
                    <div style="font-size: 1.5em; color: #ffffff; margin-bottom: 5px;">
                        <span style="color: ${index === 0 ? '#ffcd00' : '#b8c9d9'}; margin-right: 8px;">${rankBadge}</span>
                        ${server.name}${ownershipBadge}
                    </div>
                    <div style="color: #b8c9d9; font-size: 0.95em;">${server.city}, ${server.country}</div>
                    <div style="color: #8195a5; font-size: 0.9em; margin-top: 5px;">
                        ${server.provider} • ${server.speed} Gbps
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 1.8em; color: ${latencyColor}; font-weight: 600;">
                        ${server.tcpLatency ? server.tcpLatency + 'ms' : 'N/A'}
                    </div>
                    <div style="color: #8195a5; font-size: 0.85em; margin-top: 4px;">
                        ${server.distance} km away
                    </div>
                </div>
            </div>
            ${server.serverCount > 1 ? `<div style="color: #8195a5; font-size: 0.85em; margin-top: 8px;">${server.serverCount} servers available in this location</div>` : ''}
        `;
        
        closestServerDiv.appendChild(serverCard);
    });
    
    closestServerDiv.classList.add('show');
}

// Display all servers without distance
async function displayAllServers() {
    serversListDiv.innerHTML = '<div style="text-align: center; padding: 50px; background: #1d3a54; color: #b8c9d9;">Loading servers...</div>';
    
    // Fetch servers (now returns cities, not individual servers)
    try {
        const response = await fetch('/api/servers');
        allCities = await response.json();
        renderCities(allCities);
        console.log(`Displayed ${allCities.length} cities`);
    } catch (error) {
        serversListDiv.innerHTML = '<div style="text-align: center; padding: 50px; background: #1d3a54; color: #ff6b6b;">Error loading servers. Please try again.</div>';
        console.error('Error loading servers:', error);
    }
}

// Sort cities based on current sort criteria
function sortCities(cities, sortBy) {
    const sorted = [...cities];
    switch(sortBy) {
        case 'country':
            sorted.sort((a, b) => a.country.localeCompare(b.country) || a.city.localeCompare(b.city));
            break;
        case 'city':
            sorted.sort((a, b) => a.city.localeCompare(b.city));
            break;
        case 'serverCount':
            sorted.sort((a, b) => b.serverCount - a.serverCount);
            break;
    }
    return sorted;
}

// Render cities to the DOM
function renderCities(cities) {
    serversListDiv.innerHTML = '';
    const sortedCities = sortCities(cities, currentSortBy);
    
    sortedCities.forEach(cityData => {
        const card = document.createElement('div');
        card.className = 'server-card';
        card.style.cursor = 'pointer';
        card.style.transition = 'all 0.3s ease';
        
        const ownershipText = cityData.owned ? '<span style="color: #ffcd00;">●</span> Owned' : 'Rented';
        const expandIcon = '<span class="expand-icon" style="float: right; font-size: 1.2em;">▼</span>';
        
        card.innerHTML = `
            <div class="city-header">
                ${expandIcon}
                <div class="server-name">${cityData.city}, ${cityData.country_code.toUpperCase()}</div>
                <div class="server-country">${cityData.country}</div>
                <div class="server-city">${cityData.provider} • ${cityData.speed} Gbps</div>
                <div class="server-city">${ownershipText}</div>
                <div class="server-distance">${cityData.serverCount} server${cityData.serverCount > 1 ? 's' : ''} available - Click to view</div>
            </div>
            <div class="server-list-container" style="display: none; margin-top: 15px; padding-top: 15px; border-top: 1px solid #2d4f6c;"></div>
        `;
        
        // Add click handler to expand/collapse
        const cityHeader = card.querySelector('.city-header');
        const serverListContainer = card.querySelector('.server-list-container');
        const expandIconEl = card.querySelector('.expand-icon');
        let serversLoaded = false;
        
        cityHeader.addEventListener('click', async () => {
            const isExpanded = serverListContainer.style.display === 'block';
            
            if (isExpanded) {
                // Collapse
                serverListContainer.style.display = 'none';
                expandIconEl.textContent = '▼';
                card.style.background = '';
            } else {
                // Expand
                serverListContainer.style.display = 'block';
                expandIconEl.textContent = '▲';
                card.style.background = '#1d3a54';
                
                // Load servers if not already loaded
                if (!serversLoaded) {
                    await loadCityServers(cityData, serverListContainer);
                    serversLoaded = true;
                }
            }
        });
        
        serversListDiv.appendChild(card);
    });
}

// Load individual servers for a city
async function loadCityServers(cityData, container) {
    container.innerHTML = '<div style="text-align: center; padding: 10px; color: #8195a5;">Loading servers...</div>';
    
    try {
        const response = await fetch(`/api/servers/${cityData.city_code}/${cityData.country_code}`);
        const servers = await response.json();
        
        if (servers.error || servers.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 10px; color: #ff6b6b;">No servers found</div>';
            return;
        }
        
        // Store server data with latency for sorting
        const serverDataList = servers.map(server => ({
            server,
            latency: null,
            element: null
        }));
        
        // Add "Test All" button at the top
        const testAllButton = document.createElement('button');
        testAllButton.textContent = `Test All ${servers.length} Servers`;
        testAllButton.style.cssText = `
            background: #3a6591;
            color: #ffffff;
            border: 1px solid #4a7ab1;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.9em;
            margin-bottom: 12px;
            width: 100%;
            transition: all 0.2s;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        `;
        testAllButton.onmouseover = () => {
            testAllButton.style.background = '#4a7ab1';
            testAllButton.style.borderColor = '#5a8ac1';
        };
        testAllButton.onmouseout = () => {
            testAllButton.style.background = '#3a6591';
            testAllButton.style.borderColor = '#4a7ab1';
        };
        
        testAllButton.addEventListener('click', async (e) => {
            e.stopPropagation();
            testAllButton.disabled = true;
            testAllButton.style.opacity = '0.6';
            testAllButton.style.cursor = 'wait';
            testAllButton.textContent = `Testing ${servers.length} servers...`;
            
            // Test all servers in parallel
            await Promise.all(serverDataList.map(async (serverData) => {
                try {
                    const response = await fetch(`/api/ping/${serverData.server.hostname}`);
                    const data = await response.json();
                    
                    if (data.status === 'success' && data.latency) {
                        serverData.latency = data.latency;
                    } else {
                        serverData.latency = 999;
                    }
                } catch (error) {
                    serverData.latency = 999;
                }
            }));
            
            renderServers();
            testAllButton.style.display = 'none';
        });
        
        const renderServers = () => {
            container.innerHTML = '';
            
            // Show "Test All" button if not all servers have been tested
            const untestedCount = serverDataList.filter(s => s.latency === null).length;
            if (untestedCount > 0) {
                testAllButton.textContent = `Test All ${servers.length} Servers`;
                testAllButton.disabled = false;
                testAllButton.style.display = 'block';
                container.appendChild(testAllButton);
            }
            
            // Sort servers: tested ones first (by latency), then untested ones
            const sortedServers = [...serverDataList].sort((a, b) => {
                if (a.latency !== null && b.latency !== null) {
                    return a.latency - b.latency;
                }
                if (a.latency !== null) return -1;
                if (b.latency !== null) return 1;
                return 0;
            });
            
            sortedServers.forEach(serverData => {
                const serverItem = document.createElement('div');
                serverItem.style.cssText = `
                    background: ${serverData.latency !== null ? '#0d1f2f' : '#0f2537'};
                    padding: 12px 15px;
                    margin-bottom: 8px;
                    border-radius: 5px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    ${serverData.latency !== null && serverData.latency < 999 ? 'border-left: 3px solid #69db7c;' : ''}
                `;
                
                const serverInfo = document.createElement('div');
                serverInfo.innerHTML = `
                    <div style="color: #ffffff; font-weight: 500; margin-bottom: 3px;">${serverData.server.hostname}</div>
                    <div style="color: #8195a5; font-size: 0.85em;">
                        ${serverData.server.ipv4_addr_in || 'No IPv4'}
                        ${serverData.server.ipv6_addr_in ? ' • IPv6 available' : ''}
                    </div>
                `;
                
                const pingButton = document.createElement('button');
                pingButton.textContent = serverData.latency !== null ? 'Test Again' : 'Test Latency';
                pingButton.className = 'test-latency-btn';
                pingButton.style.cssText = `
                    background: ${serverData.latency !== null ? '#1d3a54' : '#294f70'};
                    color: #ffffff;
                    border: 1px solid ${serverData.latency !== null ? '#3a6591' : '#3a6591'};
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 0.85em;
                    transition: all 0.2s;
                    font-weight: 500;
                    white-space: nowrap;
                `;
                pingButton.onmouseover = () => {
                    pingButton.style.background = '#3a6591';
                    pingButton.style.borderColor = '#4a7ab1';
                };
                pingButton.onmouseout = () => {
                    pingButton.style.background = serverData.latency !== null ? '#1d3a54' : '#294f70';
                    pingButton.style.borderColor = '#3a6591';
                };
                
                const latencyResult = document.createElement('div');
                latencyResult.style.cssText = `
                    min-width: 80px;
                    text-align: right;
                    font-size: 0.95em;
                `;
                
                // Show existing latency if available
                if (serverData.latency !== null) {
                    if (serverData.latency < 999) {
                        latencyResult.innerHTML = `<span style="color: #69db7c; font-weight: 600;">${serverData.latency}ms</span>`;
                    } else {
                        latencyResult.innerHTML = '<span style="color: #ff6b6b;">Timeout</span>';
                    }
                }
                
                pingButton.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    pingButton.disabled = true;
                    pingButton.textContent = 'Testing...';
                    pingButton.style.opacity = '0.6';
                    pingButton.style.cursor = 'wait';
                    latencyResult.innerHTML = '<span style="color: #ffcd00;">●</span>';
                    
                    try {
                        const response = await fetch(`/api/ping/${serverData.server.hostname}`);
                        const data = await response.json();
                        
                        if (data.status === 'success' && data.latency) {
                            serverData.latency = data.latency;
                        } else {
                            serverData.latency = 999; // Mark as timeout
                        }
                        
                        // Re-render to sort by latency
                        renderServers();
                    } catch (error) {
                        serverData.latency = 999;
                        renderServers();
                    }
                });
                
                const rightSection = document.createElement('div');
                rightSection.style.cssText = 'display: flex; align-items: center; gap: 12px;';
                rightSection.appendChild(pingButton);
                rightSection.appendChild(latencyResult);
                
                serverItem.appendChild(serverInfo);
                serverItem.appendChild(rightSection);
                container.appendChild(serverItem);
                
                serverData.element = serverItem;
            });
        };
        
        renderServers();
        
    } catch (error) {
        container.innerHTML = '<div style="text-align: center; padding: 10px; color: #ff6b6b;">Error loading servers</div>';
        console.error('Error loading city servers:', error);
    }
}

// Show status message
function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';
}

// Ping server handler
async function pingServerHandler(hostname, resultElementId) {
    const resultDiv = document.getElementById(resultElementId);
    const pingBtn = document.getElementById('pingClosestBtn');
    
    if (pingBtn) {
        pingBtn.disabled = true;
        pingBtn.textContent = 'Testing...';
    }
    
    resultDiv.innerHTML = '<span style="color: #ffcd00;">● Testing connection...</span>';
    
    try {
        const response = await fetch(`/api/ping/${hostname}`);
        const data = await response.json();
        
        if (data.status === 'success' && data.latency) {
            resultDiv.innerHTML = `<span style="color: #69db7c; font-size: 1.2em;">✓ Latency: ${data.latency} ms</span>`;
        } else {
            resultDiv.innerHTML = '<span style="color: #ff6b6b;">✗ Server timeout or unreachable</span>';
        }
    } catch (error) {
        resultDiv.innerHTML = '<span style="color: #ff6b6b;">✗ Error testing connection</span>';
    } finally {
        if (pingBtn) {
            pingBtn.disabled = false;
            pingBtn.textContent = 'Test Connection';
        }
    }
}

// Haversine formula to calculate distance between two points
function haversineDistance(lat1, lon1, lat2, lon2) {
    const toRadians = (degree) => (degree * Math.PI) / 180;
    const R = 6371; // Earth's radius in kilometers
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in kilometers
}

