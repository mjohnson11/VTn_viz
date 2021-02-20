
var nan_formats = ['', 'nan', 'NaN', 'NA', 'inf', '-inf'];

var ref_edges = ['ACAACCTACCTGCTA',
'TCAAAACGGAGTGTT',
'TATATTGAACTTTAC',
'GTTGGGCGCTTAAAG',
'CGATGATGATGATGA'];

var w;
var h;

var pop_glob;
var clicked_edge;
var bc_dir = 'freq_data';

var focus_counter = 0;

var gens = [70,1410,2640,5150,7530,10150];

var top_data;
var mut_data;
var s_x_data;
var main_svg;
var dfe_graph;
var s_x_graph;

var mut_s_data;
var bc_data = [null, null];
var bc_exp = '';

var freq_datas = [];

var neutral_muts = [51, 6, 91, 99, 102];

var fraction_plot_marked = 0.2;

var WOW_graph_counter = 0;
var WOW_content_counter = 0;
var WOW_data_counter = 0;

var env_color = { "YPD": "#000000",
                  "30_SC3": "#029e73",
                  "30_SC5": "#cc78bc",
                  "30_SC7": "#0173b2",
                  "37_SC3": "#d55e00",
                  "37_SC5": "#ca9161",
                  "37_SC7": "#de8f05"};

function is_that_a_number(stringy_thing) {
  // guesses if a string is a number
  // from Angular code here: https://stackoverflow.com/questions/18082/validate-decimal-numbers-in-javascript-isnumeric
  return !isNaN(stringy_thing - parseFloat(stringy_thing));
}

class WowMarkerPlot {

  constructor(dimensions, parent_data, xvar, yvar, color_by=null, xrange_given=false, yrange_given=false) {
    WOW_graph_counter += 1;
    this.parent_data = parent_data;
    this.x = xvar;
    this.y = yvar;
    this.x_dtype = this.parent_data.dtypes[xvar];
    this.y_dtype = this.parent_data.dtypes[yvar];
    this.graph_num = WOW_graph_counter;
    this.dimensions = dimensions;
    [this.left, this.top, this.w, this.h] = dimensions;
    let self = this;
    this.graph_stuff = this.parent_data.svg.append('g');
    this.axes = this.graph_stuff.append('g');
    this.color_by = color_by;

    this.point_size = Math.ceil(Math.sqrt(this.w*this.h*fraction_plot_marked/(Math.PI*this.parent_data.data.length)));
    this.plotted_yet = false;

    this.xlabel = this.graph_stuff.append('text')
      .html(xvar)
      .attr('text-anchor', 'middle')
      .attr('class', 'plot_option plot_xlabel')
      .attr('x', this.left+this.w/2)
      .attr('y', this.top+this.h+30);

    this.ylabel = this.graph_stuff.append('text')
      .html(yvar)
      .attr('text-anchor', 'middle')
      .attr('class', 'plot_option plot_ylabel')
      .attr('x', this.left)
      .attr('y', this.top-15);

    this.axes.append('g').attr("transform", "translate(0,"+(self.top+self.h)+")").attr('id', 'x_axis_graph_'+String(self.graph_num));
    this.axes.append('g').attr("transform", "translate("+self.left+", 0)").attr('id', 'y_axis_graph_'+String(self.graph_num));
    this.update_plot(xrange_given, yrange_given);
  }

  add_title(title) {
    this.title = this.graph_stuff.append('text')
      .html(title)
      .attr('text-anchor', 'middle')
      .attr('class', 'plot_option plot_title')
      .attr('x', this.left+this.w/2)
      .attr('y', this.top-10);
  }

  set_pointradius(pr) {
    this.point_size = pr;
    let self = this;
    this.parent_data.svg.selectAll('.mark_on_graph_'+String(self.graph_num))
        .attr('r', self.point_size);
  }

  add_hover_el(position, func_for_text) {
    let self = this;
    var hover_el = this.graph_stuff.append('text')
      .html('')
      .attr('text-anchor', 'left')
      .attr('class', 'plot_option plot_hover_el')
      .attr('x', this.left+this.w*position[0])
      .attr('y', this.top+this.h-this.h*position[1]);

    this.parent_data.svg.selectAll('.mark_on_graph_'+String(self.graph_num))
      .on('mouseover', function(event, d) { hover_el.html(func_for_text(d)); });
    
  }

  update_plot(xrange_given=false, yrange_given=false) {
    console.log(xrange_given, yrange_given);
    let self = this;
    var xvar = self.x;
    var yvar = self.y;
    if (this.x_dtype == 'Number') {
      let xd;
      if (xrange_given) {
        xd = xrange_given;
      } else {
        xd = this.parent_data.number_domains[this.x];
      }
      this.xScale = d3.scaleLinear()
        .domain([xd[0]-(xd[1]-xd[0])/10, xd[1]+(xd[1]-xd[0])/10])
        .range([self.left, self.left+self.w]);
      if (!this.y) { // histogram
        self.n_bins = Math.round(self.parent_data.data.length/8);
        self.bin_size = (xd[1]-xd[0])/self.n_bins;
        self.bin_counts = {}
        for (let i=0; i<(self.n_bins+1); i++) {
          self.bin_counts[i] = 0;
        }
        for (let i=0; i<this.parent_data.data.length; i++) {
          let bin = Math.floor((this.parent_data.data[i][this.x]-xd[0])/self.bin_size);
          this.parent_data.data[i][this.x+'_binned'] = xd[0]+(bin+0.5)*self.bin_size;
          this.parent_data.data[i][this.x+'_binpos'] = self.bin_counts[bin]+0.5;
          self.bin_counts[bin] += 1;
        }
        this.yScale = d3.scaleLinear()
          .domain([0, Math.max(...Object.values(self.bin_counts))])
          .range([self.top+self.h, self.top]);
        xvar = self.x+'_binned';
        yvar = self.x+'_binpos';
      }
    } else if (this.x_dtype == 'String') {
      if (!this.y) { 
        // categorical histogram (weird barplot thingy) (otherwise swarmplot or intersection plot)
        let x_val_counts = {};
        for (let i=0; i<this.parent_data.data.length; i++) {
          let tmp_val = this.parent_data.data[i][this.x];
          if (tmp_val in x_val_counts) {
            x_val_counts[tmp_val] += 1;
          } else {
            x_val_counts[tmp_val] = 1;
          }
          this.parent_data.data[i][this.x+'_binpos'] = x_val_counts[tmp_val]-0.5;
        }
        this.yScale = d3.scaleLinear()
          .domain([0, Math.max(...Object.values(x_val_counts))])
          .range([self.top+self.h, self.top]);
        yvar = this.x+'_binpos';
      }
      let xd = this.parent_data.string_sets[this.x];
      this.xScale = d3.scalePoint()
          .domain(xd)
          .range([self.left+self.w/xd.length, self.left+self.w]);
    } 
    if (this.y) {
      console.log(this.y_dtype);
      if (this.y_dtype == 'Number') {
        let yd;
        if (yrange_given) {
          console.log('h');
          yd = yrange_given;
        } else {
          yd = this.parent_data.number_domains[this.y];
        }
        this.yScale = d3.scaleLinear()
          .domain([yd[0]-(yd[1]-yd[0])/10, yd[1]+(yd[1]-yd[0])/10])
          .range([self.top+self.h, self.top]);
      } else if (this.y_dtype == 'String') {
        yd = this.parent_data.string_sets[this.y]
        this.yScale = d3.scalePoint()
          .domain(yd)
          .range([self.top+self.h-self.h/yd.length, self.top]);
      }
    }
    if (this.plotted_yet) {
      this.parent_data.svg.selectAll('.mark_on_graph_'+String(self.graph_num))
        .transition()
        .duration(200)
        .attr('cx', function(d) { return self.xScale(d[xvar]); })
        .attr('cy', function(d) { return self.yScale(d[yvar]); });
    } else {
      this.parent_data.svg.selectAll("."+self.parent_data.wow_data_class)
        .append('circle')
        .attr('class', 'circle_point mark_on_graph_'+String(self.graph_num))
        .attr('r', self.point_size)
        .attr('fill', function(d) {
          if (self.color_by) {
            return self.color_by[1][d[self.color_by[0]]];
          } else {
            return '#949494';
          }
        })
        .attr('cx', function(d) { return self.xScale(d[xvar]); })
        .attr('cy', function(d) { return self.yScale(d[yvar]); });
    }
    this.xAxis = d3.axisBottom().scale(self.xScale);
    this.yAxis = d3.axisLeft().scale(self.yScale);
    d3.select('#x_axis_graph_'+String(self.graph_num)).call(self.xAxis);
    d3.select('#y_axis_graph_'+String(self.graph_num)).call(self.yAxis);
    this.plotted_yet = true;
  }

  color_key(x_spot=0.8, y_spot=1) {
    let self = this;
    let gap = self.point_size * 4;
    let key_data = [];
    for (let var_value in self.color_by[1]) {
      key_data.push({'val': var_value, 'color': self.color_by[1][var_value]});
    }
    this.parent_data.svg.selectAll(".legend_mark_"+String(self.graph_num)).remove();
    this.parent_data.svg.selectAll(".legend_mark_"+String(self.graph_num))
      .data(key_data)
      .enter()
      .append('circle')
      .attr('class', 'circle_point legend_mark_'+String(self.graph_num))
      .attr('r', self.point_size)
      .attr('fill', function(d) {return d['color'];})
      .attr('cx', function(d) { return self.left+self.w*x_spot; })
      .attr('cy', function(d, i) { return self.top+self.h-self.h*y_spot+gap*i; });

    this.parent_data.svg.selectAll(".legend_text_"+String(self.graph_num)).remove();
    this.parent_data.svg.selectAll(".legend_text_"+String(self.graph_num))
      .data(key_data)
      .enter()
      .append('text')
      .attr('class', 'legend_text_'+String(self.graph_num))
      .style('font-size', self.point_size*4-4)
      .html(function(d) {return d['val'];})
      .attr('x', function(d) { return self.left+self.w*x_spot+gap/2; })
      .attr('y', function(d, i) { return self.top+self.h-self.h*y_spot+gap*i+self.point_size; });
  }

  kill() {
    this.plot = false;
    this.graph_stuff.remove();
    this.parent_data.svg.selectAll('.mark_on_graph_'+String(this.graph_num)).remove();
  }

}

class WowSeriesPlot {

  constructor(dimensions, parent_data, xvar, yvar, color_by=null, line_weight=null) {
    WOW_graph_counter += 1;
    this.parent_data = parent_data;
    this.x = xvar;
    this.y = yvar;
    this.x_dtype = this.parent_data.dtypes[xvar];
    this.y_dtype = this.parent_data.dtypes[yvar];
    this.graph_num = WOW_graph_counter;
    this.dimensions = dimensions;
    [this.left, this.top, this.w, this.h] = dimensions;
    let self = this;
    this.graph_stuff = this.parent_data.svg.append('g');
    this.axes = this.graph_stuff.append('g');
    this.color_by = color_by;
    if (line_weight) {
      this.line_weight = line_weight;
    } else {
      this.line_weight = Math.min(Math.ceil(Math.sqrt(this.w*this.h*fraction_plot_marked/(Math.PI*this.parent_data.data.length))/2), 4);
    }
    this.plotted_yet = false;

    this.xlabel = this.graph_stuff.append('text')
      .html(xvar)
      .attr('text-anchor', 'middle')
      .attr('class', 'plot_option plot_xlabel')
      .attr('x', this.left+this.w/2)
      .attr('y', this.top+this.h+30);

    this.ylabel = this.graph_stuff.append('text')
      .html(yvar)
      .attr('text-anchor', 'middle')
      .attr('class', 'plot_option plot_ylabel')
      .attr('x', this.left)
      .attr('y', this.top-15);

    this.axes.append('g').attr("transform", "translate(0,"+(self.top+self.h)+")").attr('id', 'x_axis_graph_'+String(self.graph_num));
    this.axes.append('g').attr("transform", "translate("+self.left+", 0)").attr('id', 'y_axis_graph_'+String(self.graph_num));

    this.update_plot();
  }

  make_scale(d, x_or_y, scale_type) {
    let self = this;
    if (scale_type == 'Linear') {
      let range = (x_or_y == 'x') ? [self.left, self.left+self.w] : [self.top+self.h, self.top];
      return d3.scaleLinear().domain([d[0]-(d[1]-d[0])/10, d[1]+(d[1]-d[0])/10]).range(range);
    } else if (scale_type == 'Qual') {
      let range = (x_or_y == 'x') ? [self.left+self.w/d.length, self.left+self.w] : [self.top+self.h-self.h/d.length, self.top];
      return d3.scalePoint().domain(d).range(range);
    }
  }

  add_title(title) {
    this.title = this.graph_stuff.append('text')
      .html(title)
      .attr('text-anchor', 'middle')
      .attr('class', 'plot_option plot_title')
      .attr('x', this.left+this.w/2)
      .attr('y', this.top-10);
  }

  update_plot() {
    let self = this;
    this.line = d3.line();
    if (this.y_dtype == 'Series_Number') {
      let yd = this.parent_data.number_domains[this.y];
      this.yScale = this.make_scale(yd, 'y', 'Linear');
      this.line.y(function(d) { return self.yScale(Number(d.y)); });
    } else if (this.y_dtype == 'Series_String') {
      yd = this.parent_data.string_sets[this.y]
      this.yScale = this.make_scale(yd, 'y', 'Qual')
      this.line.y(function(d) { return self.yScale(d.y); });
    }
    if (!this.x) { // assume x series is just integers up
      let xd = [0, this.parent_data.series_lengths[this.y][1]];
      this.xScale = this.make_scale(xd, 'x', 'Linear');
      this.line.x(function(d, i) { return self.xScale(i); });
    } else {
      if (this.x_dtype == 'Series_Number') {
        let xd = this.parent_data.number_domains[this.x];
        this.xScale = this.make_scale(xd, 'x', 'Linear');
        this.line.x(function(d) { return self.xScale(Number(d.x)); });
      } else if (this.x_dtype == 'Series_String') {
        let xd = this.parent_data.string_sets[this.x]
        this.xScale = this.make_scale(xd, 'x', 'Qual');
        this.line.x(function(d) { return self.xScale(d.x); });
      }
    }
    this.parent_data.svg.selectAll("."+self.parent_data.wow_data_class)
      .append('path')
      .attr('class', 'path_mark mark_on_graph_'+String(WOW_graph_counter))
      .attr('stroke-width', self.line_weight)
      .attr('stroke', function(d) {
        if (self.color_by) {
          return self.color_by[1][d[self.color_by[0]]];
        } else {
          return '#949494';
        }
      })
      .attr('fill', 'none')
      .attr('d', function(d) { 
        let yvals = d[self.y].split(';');
        let xvals;
        if (self.x) {
          xvals = d[self.x].split(';');
        }
        let tmp_line_data = [];
        for (let i=0; i<yvals.length; i++) {
          let tmp_point = {'y': yvals[i]};
          if (self.x) {
            tmp_point['x'] = xvals[i];
          } else {
            tmp_point['x'] = i;
          }
          if ((nan_formats.indexOf(tmp_point['x'])==-1) && (nan_formats.indexOf(tmp_point['y'])==-1)) tmp_line_data.push(tmp_point);
        }
        return self.line(tmp_line_data);
      });
    this.xAxis = d3.axisBottom().scale(self.xScale);
    this.yAxis = d3.axisLeft().scale(self.yScale);
    d3.select('#x_axis_graph_'+String(self.graph_num)).call(self.xAxis);
    d3.select('#y_axis_graph_'+String(self.graph_num)).call(self.yAxis);
    this.plotted_yet = true;
  }

  kill() {
    this.plot = false;
    this.graph_stuff.remove();
    this.parent_data.svg.selectAll('.mark_on_graph_'+String(this.graph_num)).remove();
  }
}

class WowImg {

  constructor(dimensions, parent_data, xvar, color_by=null, line_weight=null) {
    WOW_content_counter += 1;
    this.parent_data = parent_data;
    this.x = xvar;
    this.x_dtype = this.parent_data.dtypes[xvar];
    this.graph_num = WOW_content_counter;
    this.dimensions = dimensions;
    [this.left, this.top, this.w, this.h] = dimensions;
    let self = this;
    this.graph_stuff = this.parent_data.svg.append('g');

    this.parent_data.svg.selectAll('.' + self.parent_data.wow_data_class)
        .append('image')
        .attr('class', 'image_content content_'+String(self.graph_num))
        .attr('preserveAspectRatio', "xMidYMid meet")
        .attr('x', this.left)
        .attr('y', this.top)
        .attr('width', this.w)
        .attr('height', this.h)
        .attr('href', function(d) { return d[self.x]; });
  }

  kill() {
    this.plot = false;
    this.graph_stuff.remove();
    this.parent_data.svg.selectAll('.content_'+String(this.graph_num)).remove();
  }
}

class WowText {
  /* Simple SVG text element linked to data groups */
  constructor(dimensions, parent_data, xvar) {
    this.parent_data = parent_data;
    this.x = xvar;
    WOW_content_counter += 1;
    this.content_num = WOW_content_counter;
    let self = this;
    [this.left, this.top, this.w, this.h] = dimensions;

    this.font_size = 16;
    // Everything will just be displayed as strings
    this.parent_data.svg.selectAll('.' + self.parent_data.wow_data_class)
      .append('foreignObject')
      .attr('class', 'text_content content_'+String(self.content_num))
      .attr('text-anchor', "middle")
      .attr('x', self.left)
      .attr('y', self.top)
      .attr('width', self.w)
      .attr('height', self.h)
      .style('font-size', this.font_size);

    this.parent_data.svg.selectAll('.content_'+String(self.content_num))
      .append('xhtml:div')
      .attr('class', 'text_content_div')
      .html(function(d) { return String(d[self.x]); });

  }

  kill() {
    super.kill();
    this.parent_data.svg.selectAll('.content_'+String(this.content_num)).remove();
  }
}

class WowData {
  constructor(data, svg, parent_data=null) {
    /*
    Reads tab-separated text file, associates it with column labels in the sidebar and an svg in the main space
    */
    WOW_data_counter += 1;
    this.wow_data_count = WOW_data_counter;
    this.wow_data_class = 'WOW_data_' + String(this.wow_data_count);
    this.data = data;
    this.wow_children = [];
    this.graphs = [];
    this.not_graphs = [];
    this.data = data
    this.infer_dtypes();
    console.log(this.dtypes);
    this.svg = svg;
    this.search_filters = [];
    this.tooltip_columns = [];
    this.tooltip_on = true;

    let self = this;

    //Making tooltip box
    self.tooltip = d3.select("#WOW_svg_holder").append('div')
    .attr('class', 'WOW_tooltip')
    .attr('id', self.wow_data_class+"_tooltip")
    .style('width', 200)
    .html("");


    self.svg.selectAll('.'+self.wow_data_class)
      .data(self.data)
      .enter()
      .append('g')
        .attr('class', 'WOW_data_group ' + self.wow_data_class)
        .on('mouseover', function(event, d) { 
          d3.select(this).raise(); //brings to front
          if (self.tooltip_on) {
            self.tooltip.style('display', 'block');
            self.tooltip.html(self.construct_tooltip(d));
            self.tooltip.style("left", (event.pageX+3) + "px").style("top", (event.pageY-3) + "px");
          }
        }) 
        .on("mouseout", function() { self.tooltip.style('display', 'none'); })
        .on('click', function(event, d) {
          let already_clicked = d3.select(this).classed('clicked_data');
          self.svg.selectAll('.'+self.wow_data_class).classed('clicked_data', false);
          if (!already_clicked) d3.select(this).classed('clicked_data', true);
          console.log(this, d);
          let tmp_edge = d['Edge'];
          clicked_edge = tmp_edge;
          for (let fd of freq_datas) {
            main_svg.selectAll('.'+fd.line_class).remove();
            main_svg.selectAll('.'+fd.line_class)
              .data(fd.data.filter(function(d) { return d['Edge']==tmp_edge; }))
              .enter()
              .append('path')
                .attr('class', 'bc_stuff freq_path focus_freq ' + fd.line_class)
                .attr('d', function(d) { return get_line_path(fd.lf, d); });
          }
        });
      
  }

  update_data(f_in) {
    this.f_in = f_in;
    let wow_data = this;
    let reader = new FileReader();
    reader.readAsText(f_in);
    reader.onload = function() {
      wow_data.data = d3.tsvParse(reader.result);
      update_plots();
    }
  }

  construct_tooltip(d) {
    let html_tmp = "";
    for (let column_name of this.tooltip_columns) {
      html_tmp += "<h2>"+column_name+"</h2><p>"+d[column_name]+"</p>";
    }
    return html_tmp
  }

  add_search_filter(column, dimensions, description="") {
    let sf = new Object();
    let self = this;
    sf.dimensions = dimensions;
    sf.column = column;
    this.search_filters.push(sf);
    sf.foreignObject = this.svg.append('foreignObject')
      .attr('x', dimensions[0])
      .attr('y', dimensions[1])
      .attr('width', dimensions[2])
      .attr('height', dimensions[3])
      .attr('class', 'foreign_obj');
    sf.input_descrip = sf.foreignObject.append('xhtml:p')
      .attr('class', 'text_input_description')
      .style('height', dimensions[3]/2)
      .style('font-size', (dimensions[3]/2)*0.8)
      .html(description);
    sf.text_input = sf.foreignObject.append('xhtml:input')
      .attr('type', 'text')
      .attr('class', 'text_input_filter')
      .style('height', dimensions[3]/2)
      .style('font-size', (dimensions[3]/2)*0.8)
      .on('keyup', function() { 
        self.svg.selectAll('.'+self.wow_data_class)
          .style('display', function(d) {
            for (let tmp_sf of self.search_filters) {
              if (d[tmp_sf.column].indexOf(tmp_sf.text_input.property("value"))==-1) return 'none';
            }
            return 'block';
          });
      });
  }

  kill() {
    for (let sf of this.search_filters) {
      sf.foreignObject.remove();
    }
  }

  infer_dtypes() {
    /*
    Infers the datatype of each column. Possible dtypes: 
    Number - NUMBER!
    String - any non-number variable
    Image - has to be a .png as of now
    Filename - has to be a .tsv (tab-delimited text file)
    Series_X_Number - a series with numbers on both axes (format "series:x1,y1;x2,y2;x3,y3;...")
    Series_X_String - a series with a string variable on the x-axis and numbers on the y-axis (format "series:x1,y1;x2,y2;x3,y3;...")
    */
    let example_row = this.data[0];
    this.dtypes = {};
    this.example_data = {};
    this.number_domains = {};
    this.string_sets = {}
    this.series_lengths = {}
    for (let column_name in example_row) {
      let val = "";
      let it_is_a_series = false;
      // if the value is blank ("") for the first row, keep checking rows until we find something
      let row_index = 0;
      let looking_for_example = true;
      while ((looking_for_example) && (row_index<this.data.length)) {
        let vals = String(this.data[row_index][column_name]).split(';');
        it_is_a_series = (vals.length>1) ? true : false;
        for (let i=0; i<vals.length; i++) {
          if (nan_formats.indexOf(vals[i]) == -1) {
            val = vals[i];
            looking_for_example = false;
          }
        }
        row_index += 1;
      }
      if (val.indexOf('.tsv') > -1) {
        this.dtypes[column_name] = 'Filename';
      } else if (val.indexOf('.png') > -1) {
        this.dtypes[column_name] = 'Image';
      } else if (it_is_a_series) {
        if (is_that_a_number(val)) {
          // number series, record numbers to pull max and min later
          this.dtypes[column_name] = 'Series_Number';
          let tmp_all_nums = [];
          for (let i=0; i<this.data.length; i++) {
            let tmp_series = this.data[i][column_name].split(';');
            for (let j=0; j<tmp_series.length; j++) {
              if (nan_formats.indexOf(tmp_series[j])==-1) {
                tmp_all_nums.push(Number(tmp_series[j]));
              }
            }
          }
          this.number_domains[column_name] = [Math.min(...tmp_all_nums), Math.max(...tmp_all_nums)];
        } else {
          // string series, record set of possible values
          this.dtypes[column_name] = 'Series_String';  
          this.string_sets[column_name] = [];
          for (let i=0; i<this.data.length; i++) {
            let tmp_series = this.data[i][column_name].split(';');
            for (let j=0; j<tmp_series.length; j++) {
              if (this.string_sets[column_name].indexOf(tmp_series[j])==-1) {
                this.string_sets[column_name].push(tmp_series[j]);
              }
            }
          }
        }
        // If it's series, record the min and max length
        let tmp_lens = [];
        for (let i=0; i<this.data.length; i++) {
          tmp_lens.push(this.data[i][column_name].split(';').length);
        }
        this.series_lengths[column_name] = [Math.min(...tmp_lens), Math.max(...tmp_lens)];
      } else {
        if (is_that_a_number(val)) {
          this.dtypes[column_name] = 'Number';
          let tmp_all_nums = [];
          // number column, record numbers to pull max and min later
          for (let i=0; i<this.data.length; i++) {
            if (this.data[i][column_name] != "") {
              tmp_all_nums.push(Number(this.data[i][column_name]));
            }
            this.data[i][column_name] = Number(this.data[i][column_name]);
          }
          this.number_domains[column_name] = [Math.min(...tmp_all_nums), Math.max(...tmp_all_nums)];
        } else {
          // string column, record set of possible values
          this.dtypes[column_name] = 'String';
          this.string_sets[column_name] = [];
          for (let i=0; i<this.data.length; i++) {
            if (this.string_sets[column_name].indexOf(this.data[i][column_name])==-1) {
              this.string_sets[column_name].push(this.data[i][column_name]);
            }
          }
        }
      }
    }
  }
}

function go(pop) {
  pop_glob = pop;
  freq_dats = []
  d3.selectAll('.WOW_svg').remove();
  let file = 'pop_data/'+pop+'_pop_data.tsv';
  // This is where everything is going to actually be drawn
  let dimensions = [0, 40, 1200, 800];
  main_svg = d3.select("#WOW_svg_holder").append('svg')
    .attr('class', 'WOW_svg')
    .style('left', dimensions[0])
    .style('top', dimensions[1])
    .attr('width', dimensions[2])
    .attr('height', dimensions[3]);
  d3.tsv(file).then(function(data) {
    top_data = new WowData(data, main_svg);
    top_data.tooltip_columns.push('Gene.Use');
    for (let i=0; i<6; i++) {
      if ((top_data.dtypes['rep1.s_'+gens[i]]=='Number') && (top_data.dtypes['rep2.s_'+gens[i]]=='Number')) {
        top_data.graphs.push(new WowMarkerPlot([180*i+30, 300, 140, 120], top_data, 'rep1.s_'+gens[i], 'rep2.s_'+gens[i], null, [-0.2, 0.15], [-0.2, 0.15]));
        main_svg.append('line').attr("x1", 180*i+30).attr("x2", 180*i+30+140).attr("y1", 420).attr("y2", 300).attr('stroke', 'black');
      }
      make_bc_graph(gens[i], 'A', pop, [180*i+30, 450, 140, 120]);
      make_bc_graph(gens[i], 'B', pop, [180*i+30, 600, 140, 120]);
    }
    top_data.graphs.push(new WowSeriesPlot([50, 50, 200, 150], top_data, 'gen_series', 's_series'));
    top_data.graphs.push(new WowSeriesPlot([300, 50, 200, 150], top_data, 'x_series', 's_series'));
    top_data.graphs.push(new WowImg([520, 30, 600, 250], top_data, 'edge_plot'));
    top_data.graphs.push(new WowText([420, 0, 150, 50], top_data, 'Gene.Use'));
    top_data.graphs.push(new WowText([570, 0, 400, 50], top_data, 'briefDescription'));
    top_data.add_search_filter('Gene.Use', [50, 0, 200, 40], description='Filter by gene:');

  });
  
}

function get_line_class(d) {
  if (ref_edges.indexOf(d['Edge']) > -1) {
    return 'bc_stuff freq_path ref_freq_path ' + d['Edge']+'_freq';
  } else {
    return 'bc_stuff freq_path nonref_freq_path ' + d['Edge']+'_freq';
  }
}

function get_line_path(linefunc, row) {
  let path_vals = [];
  for (let i=0;i<5;i++) {
    path_vals.push({'x':i, 'y':row['T'+String(i)+'_log10_freq']});
  }
  return linefunc(path_vals);
}

function make_bc_graph(gen, clone, pop, dim) {
  d3.tsv(bc_dir + '/G' + String(gen) + '_' + pop + '_' + clone + '_freqs.tsv').then(function(data) {
    let xs = d3.scaleLinear().domain([0,4]).range([dim[0], dim[0]+dim[2]]);
    let ys = d3.scaleLinear().domain([0,-6]).range([dim[1], dim[1]+dim[3]]);
    let tmpline = d3.line()
      .x(function(d) { return xs(d.x); })
      .y(function(d) { return ys(d.y); });

    let graph_stuff = main_svg.append('g');
    graph_stuff.append('g').attr('class', 'bc_stuff').attr("transform", "translate(0,"+(dim[1]+dim[3])+")").call(d3.axisBottom().scale(xs));
    graph_stuff.append('g').attr('class', 'bc_stuff').attr("transform", "translate("+dim[0]+", 0)").call(d3.axisLeft().scale(ys));
    
    freq_datas.push({'data': data, 'lf': tmpline, 'line_class': 'focus_lines_'+String(focus_counter)});
    focus_counter += 1;

    main_svg.selectAll('.NOTHING')
      .data(data.filter(function(d) { return (ref_edges.indexOf(d['Edge']) > -1); }))
      .enter()
      .append('path')
        .attr('class', (d) => get_line_class(d))
        .attr('d', function(d) { return get_line_path(tmpline, d); });
  });
}

function redo_bcs() {
  d3.selectAll('.bc_stuff').remove();

  freq_datas = [];
  for (let i=0; i<6; i++) {
    make_bc_graph(gens[i], 'A', pop_glob, [180*i+30, 450, 140, 120]);
    make_bc_graph(gens[i], 'B', pop_glob, [180*i+30, 600, 140, 120]);
  }
  if (clicked_edge) {
    console.log(clicked_edge);
    for (let fd of freq_datas) {
      main_svg.selectAll('.'+fd.line_class).remove();
      main_svg.selectAll('.'+fd.line_class)
        .data(fd.data.filter(function(d) { return d['Edge']==clicked_edge;}))
        .enter()
        .append('path')
          .attr('class', 'bc_stuff freq_path focus_freq ' + fd.line_class)
          .attr('d', function(d) { return get_line_path(fd.lf, d); });
    }
  }

}

function setup() {
  let pops = ['P3C03','P1C04','P3G06','P3F03','P1G04','P1B04','P3D03','P3G02','P1C05','P1F05','P3G05','P1D03'];
  d3.select('#clicker_button_div').selectAll('.clicker_button')
    .data(pops.sort())
    .enter()
    .append('div')
      .attr('class', 'clicker_button')
      .html(function(d) { return d; })
      .on('click', function(event, d) {
        d3.selectAll('.clicker_button').classed('focus_button', function(td) { return td==d; });
        go(d);
      })

  d3.select('#clicker_button_div')
      .append('div')
        .attr('class', 'clicker_button2')
        .html('combined BCs?')
        .on('click', function() {
          if (bc_dir == 'freq_data') {
            bc_dir = 'cbc_freqs';
            d3.select(this).classed('focus_button', true);
            redo_bcs();
          } else {
            bc_dir = 'freq_data';
            d3.select(this).classed('focus_button', false);
            redo_bcs();
          }
        })
}
