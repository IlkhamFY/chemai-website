// ALGORITHM: You can follow this tutorial:
// https://www.youtube.com/watch?v=urfyp-r255A&ab_channel=FrontendTips

// Select the first div element in the html file
// make a box to place the svg
// Create a subgroup within the svg to contain all paths (country outlines)
// Declare the type of projection for the geo-data (Mercator)
// Download the geodata using topojson:
//      - extract country information and boundaries
//      - Apply projection (Mercator) to extracted data information
//      - Generate paths for each country, giving them a class "country"


// ########################## MODULES: Refer to index.html head section: d3 and topojson ##############################################
const zoom = d3.zoom;
const event = d3.event;

// ########################## DATA DEFINITIONS ##############################################

// SVG's WIDTH and HEIGHT
const container = document.getElementById('mapPosition');
const width = container.clientWidth;
const height = container.clientHeight;

// DD. USER_METADATA
// user_meta = [str, ...]
// interp. a collection of countries to map against the base world map to change their color
fetch("https://raw.githubusercontent.com/ChemAI-Lab/website/refs/heads/main/metadataMap.txt")
    .then(response => response.text())
    .then(data => {
        // Parse the text data (list of countries)
        const countriesList = data.split('\n').map(country => country.trim());
        // Call a function to update the map with the list of countries
        updateMapWithCountries(countriesList);
    })
    .catch(error => console.error('Error loading country list:', error));

// const countriesList = [
//     "Mexico",
//     "Brazil",
//     "Australia",
//     ""
// ];
const svg = d3.select('#mapPosition').append('svg')
    .attr('height', '100%').attr('width', '100%');
// ########################## CODE ##############################################


// Apply the topological data
function updateMapWithCountries(countriesList) {
    // In the body of the html, add an svg component with the dimensions width,height
    // const svg = d3.select('#mapPosition').append('svg')
    //     .attr('height', height).attr('width', width);


    // Specify the type of projection for the map.
    // const projection = d3.geoMercator().scale(120).translate([width / 2, height / 1.4]);
    const projection = d3.geoMercator().scale(150);
    const path = d3.geoPath(projection)

    // Add a new group within the svg
    const g = svg.append("g");

    // data = d3.json('https://unpkg.com/world-atlas@1.1.4/world/110m.json')
    data = d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
        .then(data => {

            // Get an array of features (countries)
            const countries = topojson.feature(data, data.objects.countries);
            // Print the name of the countries in the console to help user adding them to metadata if needed
            countries.features.forEach(feature => {
                console.log(feature.properties.name);
            });

            // In the group generated, add the countries, mapped by their svg path, and name
            g.selectAll('path')
                .data(countries.features)
                .enter()
                .append('path')
                .attr('class', d => countriesList.includes(d.properties.name) ? 'country-Color' : 'country')
                .attr("d", path)
                .append('title')
                .text(d => d.properties.name);
        });
}


const minZoom = 1;
const maxZoom = 10;

svg.call(zoom().scaleExtent([minZoom, maxZoom]).on('zoom', (event) => {
    const currentZoom = event.transform.k;
    d3.select('svg g').attr('transform', event.transform);

}

))