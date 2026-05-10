// Animated line chart: monthly crime trend with gradient area fill
// Responds to borough and crime type filters, click dot to filter by month
function drawLineChart(crimeData, containerId, selectedBorough, selectedType, selectedMonth) {
    const container = d3.select(containerId);
    container.html("");

    const box = container.node().getBoundingClientRect();
    const margin = { top: 15, right: 20, bottom: 45, left: 52 };
    const W = box.width - margin.left - margin.right;
    const H = box.height - margin.top - margin.bottom;

    // apply borough + crime type filters
    let filtered = crimeData;
    if (selectedBorough) filtered = filtered.filter(d => d.Borough === selectedBorough);
    if (selectedType)    filtered = filtered.filter(d => d.Crime_Type === selectedType);

    // aggregate by month
    const monthly = Array.from(
        d3.rollup(filtered, v => d3.sum(v, r => r.Count), d => d.Month),
        ([month, count]) => ({ Month: month, Count: count })
    ).sort((a, b) => d3.ascending(a.Month, b.Month));

    const svg = container.append("svg")
        .attr("width", W + margin.left + margin.right)
        .attr("height", H + margin.top + margin.bottom)
        .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scalePoint().domain(monthly.map(d => d.Month)).range([0, W]).padding(0.3);
    const y = d3.scaleLinear().domain([0, d3.max(monthly, d => d.Count) * 1.1]).range([H, 0]).nice();

    // axes
    svg.append("g").attr("transform", `translate(0,${H})`)
        .call(d3.axisBottom(x).tickFormat(d => d.slice(5)))
        .selectAll("text").attr("transform","rotate(-35)").style("text-anchor","end");
    svg.append("g").call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(".2s")));

    // gradient area fill
    const defs = svg.append("defs");
    const grad = defs.append("linearGradient").attr("id","line-grad").attr("x1",0).attr("y1",0).attr("x2",0).attr("y2",1);
    grad.append("stop").attr("offset","0%").attr("stop-color","rgba(225,78,202,0.35)");
    grad.append("stop").attr("offset","100%").attr("stop-color","rgba(225,78,202,0)");

    const area = d3.area().x(d=>x(d.Month)).y0(H).y1(d=>y(d.Count)).curve(d3.curveMonotoneX);
    svg.append("path").datum(monthly).attr("d", area).attr("fill","url(#line-grad)");

    // line with draw animation
    const line = d3.line().x(d=>x(d.Month)).y(d=>y(d.Count)).curve(d3.curveMonotoneX);
    const path = svg.append("path").datum(monthly)
        .attr("fill","none").attr("stroke","#e14eca").attr("stroke-width",2.5).attr("d", line);
    const len = path.node().getTotalLength();
    path.attr("stroke-dasharray",`${len} ${len}`).attr("stroke-dashoffset", len)
        .transition().duration(1000).ease(d3.easeQuadOut).attr("stroke-dashoffset", 0);

    // visible dots (small white circles)
    svg.selectAll(".dot")
        .data(monthly).join("circle").attr("class","dot")
        .attr("cx", d=>x(d.Month)).attr("cy", d=>y(d.Count))
        .attr("r", d => (selectedMonth === d.Month) ? 8 : 4)
        .attr("fill", d => (selectedMonth === d.Month) ? "#00e5c0" : "#fff")
        .attr("stroke", d => (selectedMonth === d.Month) ? "#fff" : "#e14eca")
        .attr("stroke-width", 2)
        .attr("opacity", 0)
        .transition().delay(1000).duration(300).attr("opacity", 1);

    // invisible hitbox circles (large radius for easy hovering)
    svg.selectAll(".hitbox")
        .data(monthly).join("circle").attr("class","hitbox")
        .attr("cx", d=>x(d.Month)).attr("cy", d=>y(d.Count))
        .attr("r", 18).attr("fill","transparent").attr("cursor","pointer")
        // HOVER
        .on("mouseover", function(evt, d) {
            // enlarge the visible dot
            d3.select(this.parentNode).selectAll(".dot")
                .filter(dd => dd.Month === d.Month)
                .attr("r", 8).attr("fill","#e14eca");
            showTip(evt, `<strong>${d.Month}</strong><hr>
                🚨 Crimes: <span class="val-mag">${d3.format(",")(d.Count)}</span>
                ${selectedMonth === d.Month ? '<br><em style="color:#00e5c0">✓ Active filter</em>' : '<br><em style="color:#666">Click to filter by month</em>'}`);
        })
        .on("mousemove", moveTip)
        .on("mouseout", function(evt, d) {
            d3.select(this.parentNode).selectAll(".dot")
                .filter(dd => dd.Month === d.Month)
                .attr("r", (selectedMonth === d.Month) ? 8 : 4)
                .attr("fill", (selectedMonth === d.Month) ? "#00e5c0" : "#fff");
            hideTip();
        })
        // CLICK  select month (filters heatmap + KPIs)
        .on("click", (evt, d) => window.selectMonth(d.Month));

    // axis label
    svg.append("text").attr("x",W/2).attr("y",H+40).attr("text-anchor","middle")
        .style("fill","#666").style("font-size","11px").text("Month (2024–2025)");
}
