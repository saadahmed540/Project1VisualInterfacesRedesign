// Loading CSV file and TopoJSON file
Promise.all([
    d3.csv("data/national_health_data_2024.csv"),
    d3.json("data/counties-10m.json")
 ]).then(([data, geoData]) => {
    console.log("CSV Data Loaded:", data);
    console.log("JSON Data Loaded:", geoData);
 
    if (geoData.objects.counties) {
        var geoJSON = topojson.feature(geoData, geoData.objects.counties);
        console.log("GeoJSON conversion successful:", geoJSON);
    } else {
        console.error("GeoJSON conversion failed: Missing 'counties' in TopoJSON file.");
        return;
    }
    let brushingEnabled = false; // At the top, outside of the functions

let currentData = data;
let currentAttr = "elderly_percentage"; // or whatever the default attribute is
//let geoJSON = topojson.feature(geoData, geoData.objects.counties);

const colorMapping = {
    "elderly_percentage": d3.interpolateOranges,
    "percent_no_health_insurance": d3.interpolateWarm,
    "median_household_income": d3.interpolateBrBG,
    "education_less_than_high_school_percent": d3.interpolateMagma
};

 
    data.forEach(d => {
        d.cnty_fips = d.cnty_fips.toString().padStart(5, "0");
        d.elderly_percentage = +d.elderly_percentage || 0;//passing the attributes
        d.percent_no_health_insurance = +d.percent_no_heath_insurance || 0; 
        d.median_household_income = +d.median_household_income || 0;
        d.education_less_than_high_school_percent = +d.education_less_than_high_school_percent || 0; 
    });
 
    updateVisualizations("elderly_percentage");
 
    document.getElementById("x-attribute-select").addEventListener("change", function () {
     let selectedXAttribute = this.value;
     let selectedYAttribute = document.getElementById("attribute-select").value;
     updateVisualizations(selectedXAttribute, selectedYAttribute);
 });
 
 document.getElementById("attribute-select").addEventListener("change", function () {
     let selectedXAttribute = document.getElementById("x-attribute-select").value;
     let selectedYAttribute = this.value;
     updateVisualizations(selectedXAttribute, selectedYAttribute);
 });
 
 function updateVisualizations(xAttr, yAttr) {

     if(yAttr==undefined){
         yAttr="elderly_percentage";
     }

     currentData = data;
    currentAttr = yAttr;


     d3.select("#histogram-elderly").selectAll("*").remove();
     d3.select("#map-elderly").selectAll("*").remove();
     d3.select("#map-income").selectAll("*").remove();
 
     const colorMapping = {
         "elderly_percentage": d3.interpolateOranges,
         "percent_no_health_insurance": d3.interpolateWarm,
         "median_household_income": d3.interpolateBrBG,
         "education_less_than_high_school_percent": d3.interpolateMagma
     };
 
     let colorScheme = colorMapping[yAttr] || "Greys";
 
     if (data.some(d => d[yAttr] > 0)) {
        createHistogram(data, yAttr, "#histogram-elderly", `${yAttr.replace(/_/g, " ")} (%)`, "Reds", geoJSON);
         createScatterPlot(data, xAttr, yAttr, "#scatterplot");  
     } else {
         d3.select("#histogram-elderly").append("p").text("No valid data available for histogram.");
         d3.select("#scatterplot").append("p").text("No valid data available for scatter plot.");
     }
     createChoroplethMap(data, geoJSON, yAttr, "#map-elderly", `${yAttr.replace(/_/g, " ")} (%)`, colorScheme);
    // createChoroplethMap(data, geoJSON, "median_household_income", "#map-income", "Median Household Income", "Greens");
    createHistogram(data, yAttr, "#histogram-elderly", `${yAttr.replace(/_/g, " ")} (%)`, "Reds", geoJSON);


    
 }
 
 function createHistogram(data, attr, container, title, color, geoJSON) {
    const validData = data.filter(d => d[attr] > 0);
    if (validData.length === 0) {
        d3.select(container).html("<p>No data available for histogram.</p>");
        return;
    }

    const width = 500, height = 300, margin = { top: 20, right: 30, bottom: 60, left: 70 };

    let svg = d3.select(container).select("svg");
    if (svg.empty()) {
        svg = d3.select(container)
            .append("svg")
            .attr("width", width)
            .attr("height", height);

        svg.append("text")
            .attr("class", "x-label")
            .attr("x", width / 2)
            .attr("y", height - 10)
            .attr("text-anchor", "middle");

        svg.append("text")
            .attr("class", "y-label")
            .attr("transform", "rotate(-90)")
            .attr("y", 15)
            .attr("x", -height / 2)
            .attr("text-anchor", "middle");
    }

    const x = d3.scaleLinear()
        .domain(d3.extent(validData, d => d[attr])).nice()
        .range([margin.left, width - margin.right]);

    const bins = d3.histogram()
        .domain(x.domain())
        .thresholds(x.ticks(20))(validData.map(d => d[attr]));

    const y = d3.scaleLinear()
        .domain([0, d3.max(bins, d => d.length)]).nice()
        .range([height - margin.bottom, margin.top]);

    const tooltip = d3.select("body").select(".tooltip");
    if (tooltip.empty()) {
        d3.select("body").append("div").attr("class", "tooltip").style("display", "none");
    }

    svg.selectAll(".x-axis").remove();
    svg.selectAll(".y-axis").remove();

    svg.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(x).ticks(8).tickFormat(d3.format(".2s")))
        .call(g => g.selectAll("text")
            .attr("transform", "rotate(-30)")
            .style("text-anchor", "end"));

    svg.append("g")
        .attr("class", "y-axis")
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(y));

    svg.select(".x-label")
        .text(attr.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()))
        .style("font-size", "16px")
        .style("font-weight", "bold");

    svg.select(".y-label")
        .text("Frequency")
        .style("font-size", "16px")
        .style("font-weight", "bold");

    const selectedBins = new Set();

    const bars = svg.selectAll("rect").data(bins);

    bars.exit().transition().duration(500).attr("height", 0).remove();

    bars.transition().duration(500)
        .attr("x", d => x(d.x0) + 1)
        .attr("y", d => y(d.length))
        .attr("width", d => Math.max(0, x(d.x1) - x(d.x0) - 1))
        .attr("height", d => y(0) - y(d.length));

    bars.enter().append("rect")
        .attr("x", d => x(d.x0) + 1)
        .attr("y", height - margin.bottom)
        .attr("width", d => Math.max(0, x(d.x1) - x(d.x0) - 1))
        .attr("height", 0)
        .attr("fill", "#addd8e")
        .attr("opacity", 0.8)
        .on("mouseover", function (event, d) {
            d3.select(this).transition().duration(200).attr("opacity", 1);
            tooltip.style("display", "block")
                .html(`Range: ${d.x0.toFixed(2)} - ${d.x1.toFixed(2)}<br>Count: ${d.length}`)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 20) + "px");
        })
        .on("mouseout", function () {
            d3.select(this).transition().duration(200).attr("opacity", 0.8);
            tooltip.style("display", "none");
        })
        .on("click", function (event, d) {
            const binId = `${d.x0}-${d.x1}`;
            const isSelected = selectedBins.has(binId);

            if (isSelected) {
                selectedBins.delete(binId);
                d3.select(this).attr("stroke", null);
            } else {
                selectedBins.add(binId);
                d3.select(this).attr("stroke", "black").attr("stroke-width", 2);
            }

            const filtered = data.filter(row =>
                Array.from(selectedBins).some(bin => {
                    const [x0, x1] = bin.split("-").map(Number);
                    return row[attr] >= x0 && row[attr] < x1;
                })
            );

            const finalData = selectedBins.size > 0 ? filtered : data;

            createScatterPlot(finalData, document.getElementById("x-attribute-select").value, attr, "#scatterplot");
            createChoroplethMap(finalData, geoJSON, attr, "#map-elderly", `${attr.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())} (%)`, color);
        })
        .transition().duration(2000)
        .attr("y", d => y(d.length))
        .attr("height", d => y(0) - y(d.length));
}


function createScatterPlot(data, xAttr, yAttr, container) {
    const validData = data.filter(d => d[xAttr] > 0 && d[yAttr] > 0);
    if (validData.length === 0) {
        d3.select(container).html("<p>No data available for scatter plot.</p>");
        return;
    }

    const width = 500, height = 300, margin = { top: 20, right: 50, bottom: 60, left: 70 };

    let svg = d3.select(container).select("svg");
    if (svg.empty()) {
        svg = d3.select(container)
            .append("svg")
            .attr("width", width)
            .attr("height", height);

        svg.append("text")
            .attr("class", "x-label")
            .attr("x", width / 2)
            .attr("y", height - 10)
            .attr("text-anchor", "middle");

        svg.append("text")
            .attr("class", "y-label")
            .attr("transform", "rotate(-90)")
            .attr("y", 15)
            .attr("x", -height / 2)
            .attr("text-anchor", "middle");
    }

    const x = d3.scaleLinear()
        .domain(d3.extent(validData, d => d[xAttr])).nice()
        .range([margin.left, width - margin.right]);

    const y = d3.scaleLinear()
        .domain(d3.extent(validData, d => d[yAttr])).nice()
        .range([height - margin.bottom, margin.top]);

    svg.selectAll(".x-axis").remove();
    svg.selectAll(".y-axis").remove();

    svg.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(x).ticks(8).tickFormat(d3.format(".2s")))
        .call(g => g.selectAll("text")
            .attr("transform", "rotate(-30)")
            .style("text-anchor", "end"));

    svg.append("g")
        .attr("class", "y-axis")
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(y));

    svg.select(".x-label")
        .text(xAttr.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()))
        .style("font-size", "16px")
        .style("font-weight", "bold");

    svg.select(".y-label")
        .text(yAttr.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()))
        .style("font-size", "16px")
        .style("font-weight", "bold");

    const points = svg.selectAll("circle").data(validData, d => d.cnty_fips);

    points.exit().transition().duration(200).attr("r", 0).attr("opacity", 0).remove();

    points.transition().duration(200)
        .attr("cx", d => x(d[xAttr]))
        .attr("cy", d => y(d[yAttr]))
        .attr("fill", "teal")
        .attr("opacity", 0.8);

    points.enter().append("circle")
        .attr("cx", d => x(d[xAttr]))
        .attr("cy", d => y(d[yAttr]))
        .attr("r", 0)
        .attr("fill", "teal")
        .attr("opacity", 0)
        .transition().duration(500)
        .attr("r", 8)
        .attr("opacity", 0.8);

    const brush = d3.brush()
        .extent([[margin.left, margin.top], [width - margin.right, height - margin.bottom]])
        .on("brush end", function (event) {
            if (!event.selection) return;
            const [[x0, y0], [x1, y1]] = event.selection;
            const selectedData = validData.filter(d =>
                x(d[xAttr]) >= x0 && x(d[xAttr]) <= x1 && y(d[yAttr]) >= y0 && y(d[yAttr]) <= y1
            );

            points.transition().duration(10)
                .attr("fill", d => selectedData.includes(d) ? "orange" : "teal");

            createHistogram(selectedData, yAttr, "#histogram-elderly", `${yAttr.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())} (%)`, "teal");
            createChoroplethMap(selectedData, geoJSON, yAttr, "#map-elderly", `${yAttr.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())} (%)`, "teal");
        });

    svg.selectAll(".brush").remove();
    svg.append("g").attr("class", "brush").call(brush);
}

 
 
function createChoroplethMap(data, geoData, attr, container, title, colorScheme) {
    d3.select(container).selectAll("*").remove();
    const width = 600, height = 600;

    const tooltip = d3.select("body").select(".tooltip").empty()
        ? d3.select("body").append("div")
            .attr("class", "tooltip")
            .style("position", "absolute")
            .style("background", "#ffffff")
            .style("color", "#2c3e50")
            .style("padding", "10px")
            .style("border", "1px solid #ccc")
            .style("border-radius", "8px")
            .style("box-shadow", "0px 2px 8px rgba(0, 0, 0, 0.15)")
            .style("font-family", "sans-serif")
            .style("font-size", "12px")
            .style("pointer-events", "none")
            .style("display", "none")
        : d3.select("body").select(".tooltip");

    const geoJSON = geoData;

    geoJSON.features.forEach(feature => {
        let county = data.find(d => d.cnty_fips === feature.id);
        feature.properties.value = county ? county[attr] : undefined;
        feature.properties.name = county ? county.display_name : "Unknown County";
    });

    const validValues = geoJSON.features
        .map(d => d.properties.value)
        .filter(v => v !== undefined);

    const extentValues = d3.extent(validValues);
    if (!extentValues[0] && !extentValues[1]) {
        d3.select(container).append("p").text("No valid data available for this attribute.");
        return;
    }

    const svg = d3.select(container).append("svg")
        .attr("width", width)
        .attr("height", height);

    const projection = d3.geoAlbersUsa().fitSize([width, height], geoJSON);
    const path = d3.geoPath().projection(projection);
    const colorScale = d3.scaleSequential(colorScheme).domain(extentValues);

    const legendWidth = 300;
    const legendHeight = 10;
    const legendX = width / 2 - legendWidth / 2;
    const legendY = height - 30;

    const defs = svg.append("defs");
    const linearGradient = defs.append("linearGradient").attr("id", "legend-gradient");

    const formattedMapTitle = title
        .replace(/_/g, " ")
        .replace(/\b\w/g, l => l.toUpperCase());

    const legendSteps = 6;

    linearGradient.selectAll("stop")
        .data(d3.range(0, 1.01, 1 / (legendSteps - 1)))
        .enter().append("stop")
        .attr("offset", d => `${d * 100}%`)
        .attr("stop-color", d => colorScale(extentValues[0] + d * (extentValues[1] - extentValues[0])));

    svg.append("text")
        .attr("x", width / 2)
        .attr("y", legendY - 20)
        .attr("text-anchor", "middle")
        .style("font-size", "13px")
        .style("font-weight", "bold")
        .text(`Distribution of ${formattedMapTitle} (%)`);

    svg.append("rect")
        .attr("x", legendX)
        .attr("y", legendY)
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .style("fill", "url(#legend-gradient)")
        .style("stroke", "#ccc")
        .style("stroke-width", 0.5);

    const tickValues = d3.range(0, legendSteps).map(i =>
        extentValues[0] + i * (extentValues[1] - extentValues[0]) / (legendSteps - 1)
    );

    const tickGroup = svg.append("g").attr("class", "legend-ticks");

    tickGroup.selectAll("text")
        .data(tickValues)
        .enter()
        .append("text")
        .attr("x", (d, i) => legendX + i * (legendWidth / (legendSteps - 1)))
        .attr("y", legendY + 25)
        .attr("text-anchor", "middle")
        .style("font-size", "11px")
        .text(d => `${d.toFixed(1)}%`);

    svg.append("text")
        .attr("x", width / 2)
        .attr("y", 30)
        .attr("text-anchor", "middle")
        .style("font-size", "20px")
        .style("font-weight", "bold")
        .style("fill", "#2c3e50")
        .text(formattedMapTitle);

    const mapPaths = svg.selectAll("path").data(geoJSON.features).enter().append("path")
        .attr("d", path)
        .attr("fill", d => d.properties.value !== undefined ? colorScale(d.properties.value) : "#ccc")
        .attr("stroke", "#000")
        .attr("stroke-width", 0.2)
        .on("click", (event, d) => {
            if (brushingEnabled) return;
            d3.selectAll("path").attr("stroke-width", 0.2);
            d3.select(event.target).attr("stroke-width", 2).attr("stroke", "black");
        });

    if (!brushingEnabled) {
        mapPaths
            .on("mouseover", (event, d) => {
                tooltip
                    .html(`
                        <div style="font-weight: bold; font-size: 14px; margin-bottom: 5px;">
                            ${d.properties.name}
                        </div>
                        <div style="font-size: 12px;">
                            ${formattedMapTitle}:
                            <span style="font-weight: bold; color: #2c3e50;">
                                ${d.properties.value !== undefined ? d.properties.value.toFixed(2) + '%' : 'No Data'}
                            </span>
                        </div>
                    `)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 28) + "px")
                    .style("display", "block");
            })
            .on("mousemove", (event) => {
                tooltip
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", () => tooltip.style("display", "none"));
    } else {
        mapPaths.on("mouseover", null).on("mouseout", null);
    }

    const brush = d3.brush()
        .extent([[0, 0], [width, height]])
        .on("end", brushEnded);

    const brushGroup = svg.append("g").attr("class", "brush");
    if (brushingEnabled) {
        brushGroup.call(brush);
    }

    function brushEnded(event) {
        if (!event.selection) return;

        const [[x0, y0], [x1, y1]] = event.selection;

        const selectedFeatures = geoJSON.features.filter(d => {
            const [cx, cy] = path.centroid(d);
            return cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;
        });

        const selectedData = data.filter(d =>
            selectedFeatures.some(f => f.id === d.cnty_fips)
        );

        svg.selectAll("path")
            .attr("stroke", d => selectedFeatures.includes(d) ? "black" : "#000")
            .attr("stroke-width", d => selectedFeatures.includes(d) ? 2 : 0.2);

        createHistogram(selectedData, attr, "#histogram-elderly", formattedMapTitle + " (%)", "teal", geoData);
        createScatterPlot(selectedData, document.getElementById("x-attribute-select").value, attr, "#scatterplot");
    }
}



document.getElementById("toggle-brush").addEventListener("click", function () {
    brushingEnabled = !brushingEnabled;
    this.textContent = brushingEnabled ? "Disable Brushing" : "Enable Brushing";

    // Defensive check
    if (!currentAttr || !geoJSON || !currentData) return;

    // Redraw the map with the updated brushing flag
    createChoroplethMap(
        currentData,
        geoJSON,
        currentAttr,
        "#map-elderly",
        `${currentAttr.replace(/_/g, " ")} (%)`,
        colorMapping[currentAttr] || d3.interpolateOranges
    );
});

document.getElementById("reset-button").addEventListener("click", function () {
    brushingEnabled = false;
    document.getElementById("toggle-brush").textContent = "Enable Brushing";

    // Reset dropdowns (optional, you can comment if you want to keep previous selections)
    document.getElementById("attribute-select").value = "elderly_percentage";
    document.getElementById("x-attribute-select").value = "elderly_percentage";

    currentData = data;
    currentAttr = "elderly_percentage";

    // Redraw all visualizations
    updateVisualizations("elderly_percentage", "elderly_percentage");
});


 }).catch(error => {
   console.error("Error loading data:", error);
 });
 