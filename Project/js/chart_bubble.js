// Bubble scatter chart: X=avg price, Y=total crime, Size=school capacity per borough
// Hover highlights across all charts, click filters the dashboard
function drawBubbleChart(housing, crimeByB, schools, containerId, selectedBorough) {
    const container = d3.select(containerId);
    container.html("");

    const box = container.node().getBoundingClientRect();
    const margin = { top: 15, right: 25, bottom: 45, left: 58 };
    const W = box.width - margin.left - margin.right;
    const H = box.height - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("width", W + margin.left + margin.right)
        .attr("height", H + margin.top + margin.bottom)
        .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // join datasets
    const crimeMap  = new Map(crimeByB.map(d => [d.Borough, d.Total_Crimes]));
    const priceMap  = d3.rollup(housing, v => d3.mean(v, r => r.Average_Price), d => d.Borough);
    const schoolMap = d3.rollup(schools, v => d3.sum(v, r => r.Total_Capacity), d => d.Borough);

    const data = Array.from(priceMap, ([b, price]) => ({
        Borough: b, Price: price,
        Crime: crimeMap.get(b) || 0,
        Schools: schoolMap.get(b) || 0,
    })).filter(d => d.Crime > 0 && d.Price > 0);

    // scales
    const x = d3.scaleLinear().domain([0, d3.max(data, d => d.Price)*1.05]).range([0,W]).nice();
    const y = d3.scaleLinear().domain([0, d3.max(data, d => d.Crime)*1.05]).range([H,0]).nice();
    const r = d3.scaleSqrt().domain([0, d3.max(data, d => d.Schools)]).range([5, 32]);
    const colour = d3.scaleSequential(d3.interpolateCool).domain([0, data.length]);

    // axes
    svg.append("g").attr("transform",`translate(0,${H})`).call(d3.axisBottom(x).ticks(6).tickFormat(d=>"£"+d3.format(".2s")(d)));
    svg.append("g").call(d3.axisLeft(y).ticks(6).tickFormat(d3.format(".2s")));
    svg.append("text").attr("x",W/2).attr("y",H+38).attr("text-anchor","middle").style("fill","#666").style("font-size","11px").text("Average Property Price");
    svg.append("text").attr("transform","rotate(-90)").attr("x",-H/2).attr("y",-44).attr("text-anchor","middle").style("fill","#666").style("font-size","11px").text("Total Crimes");

    // bubbles — big ones drawn first (behind)
    svg.selectAll("circle")
        .data(data.sort((a,b) => b.Schools - a.Schools))
        .join("circle")
        // TAG for cross-chart hover
        .attr("data-borough", d => d.Borough)
        .attr("cx", d => x(d.Price))
        .attr("cy", d => y(d.Crime))
        .attr("r", 0)
        .attr("fill", (d,i) => colour(i))
        .attr("stroke", d => (selectedBorough === d.Borough) ? "#fff" : "rgba(255,255,255,.2)")
        .attr("stroke-width", d => (selectedBorough === d.Borough) ? 3 : 1)
        .attr("opacity", d => {
            if (!selectedBorough) return 0.8;
            return d.Borough === selectedBorough ? 1 : 0.15;
        })
        .attr("cursor", "pointer")
        // HOVER  highlight across all charts
        .on("mouseover", function(evt, d) {
            window.highlightBorough(d.Borough);
            d3.select(this).transition().duration(150).attr("r", r(d.Schools)+6);
            showTip(evt, `<strong>${d.Borough}</strong><hr>
                🏠 Price: <span class="val-cyan">£${d3.format(",")(Math.round(d.Price))}</span><br>
                🚨 Crimes: <span class="val-mag">${d3.format(",")(d.Crime)}</span><br>
                🎓 School Places: <span class="val-amber">${d3.format(",")(d.Schools)}</span>`);
        })
        .on("mousemove", moveTip)
        .on("mouseout", function(evt, d) {
            window.unhighlightBorough();
            d3.select(this).transition().duration(150).attr("r", r(d.Schools));
            hideTip();
        })
        // CLICK  filter all charts
        .on("click", (evt, d) => window.selectBorough(d.Borough))
        // entrance animation
        .transition().duration(700).delay((d,i) => i*20).ease(d3.easeBackOut)
        .attr("r", d => r(d.Schools));

    // size legend
    const sizes = [5000, 20000, 50000];
    const lg = svg.append("g").attr("transform", `translate(${W-80},${H-90})`);
    lg.append("text").text("School Places").attr("y",-10).style("font-size","9px").style("fill","#666");
    sizes.forEach(s => {
        lg.append("circle").attr("cx",0).attr("cy",-r(s)).attr("r",r(s)).attr("fill","none").attr("stroke","#555");
        lg.append("text").attr("x",38).attr("y",-2*r(s)+4).text(d3.format(".0s")(s)).style("font-size","9px").style("fill","#888");
    });
}
