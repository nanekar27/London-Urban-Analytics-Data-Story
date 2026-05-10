// Vertical stacked bar chart: school capacity by phase per borough
// Colour-coded by Primary, Secondary, 16 plus, Nursery, All-through, Other

function drawSchoolChart(schoolsData, containerId, selectedBorough) {
    const container = d3.select(containerId);
    container.html("");

    const box = container.node().getBoundingClientRect();
    const margin = { top: 10, right: 20, bottom: 30, left: 130 };
    const W = box.width - margin.left - margin.right;
    const H = box.height - margin.top - margin.bottom;

   // phase_config
    const phases = ["Primary","Secondary","16 plus","Nursery","All-through","Other"];
    const phaseColours = {
        "Primary":"#2dce89","Secondary":"#5e72e4","16 plus":"#f0b429",
        "Nursery":"#fb6340","All-through":"#11cdef","Other":"#8965e0"
    };

    // pivot_data: borough
    const boroughMap = d3.group(schoolsData, d => d.Borough);
    const pivoted = Array.from(boroughMap, ([b, rows]) => {
        const obj = { Borough: b };
        let total = 0;
        phases.forEach(p => {
            const match = rows.find(r => r.Phase === p);
            obj[p] = match ? match.Total_Capacity : 0;
            total += obj[p];
        });
        obj._total = total;
        return obj;
    }).sort((a,b) => b._total - a._total);

    const stack = d3.stack().keys(phases)(pivoted);
    const colour = d3.scaleOrdinal().domain(phases).range(phases.map(p => phaseColours[p]));

    const yScale = d3.scaleBand().domain(pivoted.map(d => d.Borough)).range([0, H]).padding(0.25);
    const xScale = d3.scaleLinear().domain([0, d3.max(pivoted, d => d._total)*1.05]).range([0, W]).nice();

    const svg = container.append("svg")
        .attr("width", W + margin.left + margin.right)
        .attr("height", H + margin.top + margin.bottom)
        .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // axes
    svg.append("g").call(d3.axisLeft(yScale).tickSize(0).tickPadding(6))
        .selectAll("text").style("font-size","9px")
        .style("fill", d => (selectedBorough === d) ? "#00e5c0" : "#999")
        .style("font-weight", d => (selectedBorough === d) ? "700" : "400");
    svg.select(".domain").remove();
    svg.append("g").attr("transform",`translate(0,${H})`).call(d3.axisBottom(xScale).ticks(5).tickFormat(d3.format(".2s")));

   // stacked_bars
    svg.selectAll("g.layer")
        .data(stack).join("g").attr("class","layer")
        .attr("fill", d => colour(d.key))
        .selectAll("rect")
        .data(d => d).join("rect")
        
    // cross-chart_hover_highlighting
        .attr("data-borough", d => d.data.Borough)
        .attr("y", d => yScale(d.data.Borough))
        .attr("height", yScale.bandwidth())
        .attr("rx", 2)
        .attr("opacity", d => {
            if (!selectedBorough) return 0.85;
            return d.data.Borough === selectedBorough ? 1 : 0.2;
        })
        .attr("cursor","pointer")
    // HOVER = highlight_across_all_charts   
        .on("mouseover", function(evt, d) {
            window.highlightBorough(d.data.Borough);
            d3.select(this).attr("opacity", 1);
            const phase = d3.select(this.parentNode).datum().key;
            showTip(evt, `<strong>${d.data.Borough}</strong><hr>
                📚 ${phase}: <span class="val-cyan">${d3.format(",")(d.data[phase])}</span> places<br>
                📊 Total: ${d3.format(",")(d.data._total)} places`);
        })
        .on("mousemove", moveTip)
        .on("mouseout", function(evt, d) {
            window.unhighlightBorough();
            const active = (selectedBorough === d.data.Borough);
            d3.select(this).attr("opacity", !selectedBorough ? 0.85 : (active ? 1 : 0.2));
            hideTip();
        })

         // CLICK_filter-all-charts
        .on("click", (evt, d) => window.selectBorough(d.data.Borough))
       
         // entr_animation
        .attr("x",0).attr("width",0)
        .transition().duration(600).delay((d,i) => i*10).ease(d3.easeCubicOut)
        .attr("x", d => xScale(d[0]))
        .attr("width", d => xScale(d[1]) - xScale(d[0]));

    // legend
    const leg = svg.append("g").attr("transform", `translate(${W-130},5)`);
    phases.filter(p => pivoted.some(d => d[p] > 0)).forEach((p, i) => {
        const row = leg.append("g").attr("transform", `translate(0,${i*16})`);
        row.append("rect").attr("width",10).attr("height",10).attr("rx",2).attr("fill", colour(p));
        row.append("text").attr("x",14).attr("y",9).text(p).style("font-size","9px").style("fill","#999");
    });
}
