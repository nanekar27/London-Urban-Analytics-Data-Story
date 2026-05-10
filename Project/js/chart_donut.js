// Donut ring chart: crime type distribution with dynamic centre text
// Click slice to filter line chart and heatmap by crime type
function drawDonutChart(crimeData, containerId, selectedBorough, selectedType) {
    const container = d3.select(containerId);
    container.html("");

    const box = container.node().getBoundingClientRect();
    const W = box.width, H = box.height;
    const radius = Math.min(W, H) / 2 - 20;

    // filter by borough if active
    const filtered = selectedBorough
        ? crimeData.filter(d => d.Borough === selectedBorough)
        : crimeData;

    // aggregate by crime type
    const typeCounts = d3.rollup(filtered, v => d3.sum(v, r => r.Count), d => d.Crime_Type);
    const totalCrimes = d3.sum(Array.from(typeCounts.values()));
    const pieData = d3.pie().value(d => d[1]).sort((a,b) => b[1]-a[1])(Array.from(typeCounts));

    // vibrant palette for crime types
    const palette = [
        "#e14eca","#00e5c0","#f0b429","#5e72e4","#fb6340",
        "#2dce89","#11cdef","#8965e0","#f5365c","#ffd600",
        "#344675","#ba54f5","#ff8d72","#1d8cf8"
    ];
    const colour = d3.scaleOrdinal().domain(Array.from(typeCounts.keys())).range(palette);

    const svg = container.append("svg")
        .attr("width", W).attr("height", H)
        .append("g").attr("transform", `translate(${W/2},${H/2})`);

    const arc      = d3.arc().innerRadius(radius * 0.55).outerRadius(radius);
    const arcHover = d3.arc().innerRadius(radius * 0.55).outerRadius(radius * 1.08);

    // dynamic centre text
    const centerLabel = svg.append("text").attr("text-anchor","middle").style("fill","#fff");
    function setCentre(label, value) {
        centerLabel.html("");
        centerLabel.append("tspan").attr("x",0).attr("dy","-0.35em")
            .style("font-size","12px").style("fill","#888").text(label);
        centerLabel.append("tspan").attr("x",0).attr("dy","1.3em")
            .style("font-size","20px").style("font-weight","800").text(d3.format(",")(value));
    }
    setCentre(selectedType || "Total Crimes", selectedType ? (typeCounts.get(selectedType)||0) : totalCrimes);

    // slices
    const paths = svg.selectAll("path")
        .data(pieData).join("path")
        .attr("fill", d => colour(d.data[0]))
        .attr("stroke", d => (selectedType === d.data[0]) ? "#fff" : "#181a24")
        .attr("stroke-width", d => (selectedType === d.data[0]) ? 3 : 2)
        .attr("opacity", d => {
            if (!selectedType) return 1;
            return d.data[0] === selectedType ? 1 : 0.25;
        })
        .attr("cursor","pointer")
        .each(function(d) { this._current = {startAngle: d.startAngle, endAngle: d.startAngle}; })
        // HOVER
        .on("mouseover", function(evt, d) {
            d3.select(this).transition().duration(150).attr("d", arcHover);
            paths.style("opacity", 0.25);
            d3.select(this).style("opacity", 1);
            const pct = ((d.data[1] / totalCrimes) * 100).toFixed(1);
            setCentre(d.data[0].length > 20 ? d.data[0].slice(0,20)+"…" : d.data[0], d.data[1]);
            showTip(evt, `<strong>${d.data[0]}</strong><hr>
                Count: <span class="val-mag">${d3.format(",")(d.data[1])}</span><br>
                Share: <span class="val-cyan">${pct}%</span>
                ${selectedType === d.data[0] ? '<br><em style="color:#00e5c0">✓ Active filter — click to remove</em>' : '<br><em style="color:#666">Click to filter by this type</em>'}`);
        })
        .on("mousemove", moveTip)
        .on("mouseout", function(evt, d) {
            d3.select(this).transition().duration(150).attr("d", arc);
            paths.style("opacity", d2 => {
                if (!selectedType) return 1;
                return d2.data[0] === selectedType ? 1 : 0.25;
            });
            setCentre(selectedType || "Total Crimes", selectedType ? (typeCounts.get(selectedType)||0) : totalCrimes);
            hideTip();
        })
        // CLICK  filter by crime type (updates line + heatmap + KPIs)
        .on("click", (evt, d) => window.selectCrimeType(d.data[0]));

    // entrance animation (sweep)
    paths.transition().duration(800).attrTween("d", function(d) {
        const interp = d3.interpolate(this._current, d);
        this._current = interp(1);
        return t => arc(interp(t));
    });
}
