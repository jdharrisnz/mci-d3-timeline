var timeline = {
	'initialize': function() {
		// Store the query result
			var queryResult = DA.query.getQueryResult();

		// Ensure the query meets the conditions (move some to after settings retrieval)
			var query = DA.query.getQuery();
			if (queryResult.rows.length === 0) { // If query has no data
				var container = d3.select('#__da-app-content').append('div')
					.style('color', 'rgba(0, 1, 2, 0.49)')
					.style('width', '100%')
					.style('height', '100%')
					.style('display', 'flex')
					.style('flex-direction', 'column')
					.style('justify-content', 'center')
					.style('align-items', 'center');
				container.append('svg')
					.attr('width', '56px')
					.attr('height', '56px')
					.style('margin-bottom', '20px')
					.attr('viewBox', '0 0 20 20')
					.attr('preserveAspectRatio', 'xMidYMid meet')
					.attr('fill', 'rgba(0, 1, 2, 0.2')
					.append('path')
						.attr('d', 'M19 18.33 14.4 13.7a7.68 7.68 0 1 0-.71.71L18.33 19A.5.5 0 0 0 19 18.33Zm-10.38-3a6.66 6.66 0 1 1 6.66-6.66A6.66 6.66 0 0 1 8.66 15.31Z');
				container.append('div')
					.style('font-size', '14px')
					.style('margin-bottom', '3px')
					.text('No Data Available');
				container.append('div')
					.style('font-size', '12px')
					.text('Check data or applied filters');
				javascriptAbort();  // Garbage meaningless function to get the widget to stop processing
			}

		// Extend the date class with getWeek()
			// ISO 8601: The week with the year's January 4 in it is w01, if weeks start on Monday (dowOffset 1)
			Date.prototype.getWeek = function(dowOffset) {
				// Validate dowOffset input
					dowOffset = [0,1,2,3,4,5,6].includes(dowOffset) ? dowOffset : 1;

				// Get last, this, and next year starts
					var yearStarts = [this.getFullYear() - 1, this.getFullYear(), this.getFullYear() + 1].map(x => {
						var weekOne = new Date(x, 0, 4);
						return new Date(weekOne - (weekOne.getDay() - dowOffset) * 1000*60*60*24);
					});

				// Calculate week number based on which week-year the date we're looking at is in
				// Round clears DST differences, floor + 1 puts all days in the right week
					var weekNum = this < yearStarts[1]
						? Math.floor(Math.round((this - yearStarts[0]) / (1000*60*60*24)) / 7) + 1
						: this > yearStarts[2]
						? Math.floor(Math.round((this - yearStarts[2]) / (1000*60*60*24)) / 7) + 1
						: Math.floor(Math.round((this - yearStarts[1]) / (1000*60*60*24)) / 7) + 1;

				return 'w' + '0'.repeat(2 - String(weekNum).length) + weekNum;
			};

		// Extend the date class with getQuarter()
			Date.prototype.getQuarter = function(quarterOffset) {
				// Validate quarterOffset input, default January
					quarterOffset = [0,1,2,3,4,5,6,7,8,9,10,11].includes(quarterOffset) ? quarterOffset : 0;

				// Update the date with offset
					var offsetDate = new Date(this.getFullYear(), this.getMonth() + quarterOffset, 1);

				// Work out the year based on whether we're in the year with the ending month
					var yearDate = new Date(offsetDate.getFullYear() + (offsetDate.getMonth() < quarterOffset || quarterOffset === 0 ? 0 : 1), offsetDate.getMonth(), 1);

				// Return format example Q3 2021
					return 'Q' + Math.ceil((this.getMonth() + 1) / 3) + ' ' + yearDate.getFullYear();
			};

		// Function to get difference in days
			function dayDiff(startDate, endDate) {
				// Remove sub-day granularity
				startDate.setHours(0);
				endDate.setHours(0);
				// The large number turns milliseconds into days
				return Math.round((endDate - startDate) / (1000*60*60*24) + 1);
			}

		// Function to convert Hex to RGB
			function hexToRgb(hex) {
			  // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
			  var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
			  hex = hex.replace(shorthandRegex, function(m, r, g, b) {
			    return r + r + g + g + b + b;
			  });

			  var rgb = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
			  var result = [parseInt(rgb[1], 16), parseInt(rgb[2], 16), parseInt(rgb[3], 16)];
			  if (hex.length == 9) {
			  	var rgba = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
				  result.push(parseInt(rgb[4], 16) / 255);
			  }
			  return result;
			}

		// Wrapper function to get field details
			function getFieldDetails(systemName) {
				return new Promise((resolve, reject) => {
					DA.query.getFieldDetails({ systemName: systemName, cb: (err, data) => {
						resolve(data);
					} });
				});
			}

		// Wrapper function to get formatted value
			function getFormattedValue(systemName, value) {
				return new Promise((resolve, reject) => {
					DA.query.getFormattedValue({ systemName: systemName, value: value, cb: (err, data) => {
						resolve(data);
					} });
				});
			}

		// Wrapper function to get design settings
			function getDesignSettings() {
				return new Promise((resolve, reject) => {
					DA.widget.customDesignSettings.get( { cb: (err, params) => {
						resolve(params);
					} });
				});
			}

		// Set the design options
			var queryDims = queryResult.fields.filter(x => x.type == 'dimension');
			var queryMeas = queryResult.fields.filter(x => x.type == 'metric');

			var options = [
				{ 'type': 'title',
					'displayName': 'General Settings' },
				{ 'type': 'select',
					'id': 'granularity',
					'displayName': 'Timeline Granularity',
					'options': [
						{ 'id': 'auto', 'label': 'Auto' },
						{ 'id': 'day', 'label': 'Day'},
						{ 'id': 'week', 'label': 'Week' },
						{ 'id': 'bi-week', 'label': 'Bi-Week' },
						{ 'id': 'month', 'label': 'Month' },
						{ 'id': 'quarter', 'label': 'Quarter' }
					],
					'defaultValue': 'auto',
					'description': 'Choose a granularity for the timeline date label row. This has no effect on the precision of the timeline bars, which is always daily.' },
				{ 'type': 'select',
					'id': 'weekStart',
					'displayName': 'Start of Week',
					'options': [
						{ 'id': 0, 'label': 'Sunday' },
						{ 'id': 1, 'label': 'Monday' },
						{ 'id': 2, 'label': 'Tuesday' },
						{ 'id': 3, 'label': 'Wednesday' },
						{ 'id': 4, 'label': 'Thursday' },
						{ 'id': 5, 'label': 'Friday' },
						{ 'id': 6, 'label': 'Saturday' }
					],
					'defaultValue': 1,
					'description': 'Only has an effect when selected Timeline Granularity is Week, Bi-Week, or Auto.' },
				{ 'type': 'select',
					'id': 'yearStart',
					'displayName': 'Start of Year',
					'options': [
						{ 'id': 0, 'label': 'January' },
						{ 'id': 1, 'label': 'February' },
						{ 'id': 2, 'label': 'March' },
						{ 'id': 3, 'label': 'April' },
						{ 'id': 4, 'label': 'May' },
						{ 'id': 5, 'label': 'June' },
						{ 'id': 6, 'label': 'July' },
						{ 'id': 7, 'label': 'August' },
						{ 'id': 8, 'label': 'September' },
						{ 'id': 9, 'label': 'October' },
						{ 'id': 10, 'label': 'November' },
						{ 'id': 11, 'label': 'December' }
					],
					'defaultValue': 0,
					'description': 'Only has an effect when selected Timeline Granularity is Month, Quarter, or Auto.' },
				{ 'type': 'colorPicker',
					'id': 'barColour',
					'displayName': 'Timeline Bar Colour',
					'defaultValue': '#4879AB',
					'description': 'Only has an effect if colour coding is not set. A 100% opacity version of this will be used for the progress bar, and 40% opacity for the timeline bar background.' },
				{ 'type': 'separator' },
				{ 'type': 'title',
					'displayName': 'Dimension Roles' },
				{ 'type': 'select',
					'id': 'mainDim',
					'displayName': 'Main Dimension',
					'options': queryDims.map(x => { return { 'id': x.systemName, 'label': x.name }; }),
					'defaultValue': queryDims[0]?.systemName,
					'description': 'Select the field by which to group timeline bars. This will also be used as the label.' },
				{ 'type': 'select',
					'id': 'startDate',
					'displayName': 'Start Date',
					'options': queryDims.map(x => { return { 'id': x.systemName, 'label': x.name }; }),
					'defaultValue': queryDims[1]?.systemName,
					'description': 'Select the start date related to the main dimension. The widget may fail if it\'s not of type "date".' },
				{ 'type': 'select',
					'id': 'endDate',
					'displayName': 'End Date',
					'options': queryDims.map(x => { return { 'id': x.systemName, 'label': x.name }; }),
					'defaultValue': queryDims[2]?.systemName,
					'description': 'Select the end date related to the main dimension. The widget may fail if it\'s not of type "date".' },
				{ 'type': 'select',
					'id': 'groupDim',
					'displayName': 'Timeline Groups',
					'options': [{ 'id': 'None', 'label': 'None' }].concat(queryDims.map(x => { return { 'id': x.systemName, 'label': x.name }; })),
					'defaultValue': 'None',
					'description': 'Select the dimension by which to segment the timeline. If "None" is selected, a single group will be created with the name of the main dimension.' },
				{ 'type': 'select',
					'id': 'colourDim',
					'displayName': 'Timeline Colour Coding',
					'options': [{ 'id': 'None', 'label': 'None' }].concat(queryDims.map(x => { return { 'id': x.systemName, 'label': x.name }; })),
					'defaultValue': 'None',
					'description': 'Select the dimension by which to colour code the bars.' },
				{ 'type': 'select',
					'id': 'colourSet',
					'displayName': 'Colour Coding Scale',
					'options': ['Turbo', 'Viridis', 'Inferno', 'Magma', 'Plasma', 'Cividis', 'Warm', 'Cool'].map(x => { return { 'id': x, 'label': x }; }),
					'defaultValue': 'Turbo',
					'description': 'If Timeline Colour Coding is used, colours will be picked from the selected scale.' },
				{ 'type': 'separator' },
				{ 'type': 'title',
					'displayName': 'Measurement Roles' },
				{ 'type': 'select',
					'id': 'numerator',
					'displayName': 'Progress Bar Numerator',
					'options': [{ 'id': 'None', 'label': 'None (no progress bars)' }].concat(queryMeas.map(x => { return { 'id': x.systemName, 'label': x.name }; })),
					'defaultValue': queryMeas[0]?.systemName ?? 'None',
					'description': 'Select the metric that measures progress against a target (e.g., Media Cost). If this is set but the denominator (below) is not, it will just be used as a label.' },
				{ 'type': 'select',
					'id': 'denominator',
					'displayName': 'Progress Bar Denominator',
					'options': [{ 'id': 'None', 'label': 'None (no progress bars)' }].concat(queryMeas.map(x => { return { 'id': x.systemName, 'label': x.name }; })),
					'defaultValue': queryMeas[1]?.systemName ?? 'None',
					'description': 'Select the metric that provides the target against which progress is measured (e.g., Budget).' },
				{ 'type': 'separator' },
				{ 'type': 'title',
					'displayName': 'Mouseover Tooltip Inclusion' },
				{ 'type': 'checkbox',
					'id': 'tooltip',
					'displayName': 'Include In Tooltip',
					'options': queryResult.fields.filter(x => x.type == 'dimension').map(x => { return { 'id': x.systemName, 'label': x.name, 'defaultValue': true }; }),
					'description': 'If unchecked, the field and value won\'t appear in the mouseover tooltips.' }
			];

			DA.widget.customDesignSettings.set(options);

		// Get the design settings, then create the widget
			getDesignSettings().then(settings => {
				// Function to get bar colours
					function getBarColour(data, elementType) {
						var opacity = elementType == 'bar' ? 0.2 : 1;
						if (settings.colourDim == 'None') {
							var barColour = hexToRgb(settings.barColour);
							if (barColour.length == 3) {
								return 'rgba(' + barColour.join(', ') + ', '+ opacity + ')';
							}
							else if (barColour.length == 4) {
								barColour[3] = opacity;
								return 'rgba(' + barColour.join(', ') + ')';
							}
						}
						else {
							var resultColour = colourScale((colourGroups.indexOf(data[colourDimIndex].formattedValue) + 1) / colourGroups.length);
							resultColour = resultColour.includes('#') ? 'rgb(' + hexToRgb(resultColour).join(',') + ')' : resultColour;
							return 'rgba' + resultColour.slice(3, resultColour.length - 1) + ', ' + opacity + ')';
						}
					}

				// Set some useful variables
					var queryStart = new Date(query.filter['Start Date'].value[0].value[0]);
					var queryEnd = new Date(query.filter['End Date'].value[0].value[0]);
					var daySpan = dayDiff(queryStart, queryEnd);

				// Create the document structure and set the grid size
					var container = d3.select('#__da-app-content').append('div')
						.attr('id', 'container');
					var header = container.append('div')
						.attr('id', 'header')
						.style('grid-template-columns', 'repeat(' + daySpan + ', minmax(0, 1fr))');
					var body = container.append('div')
						.attr('id', 'body');
					var tooltip = d3.select('#__da-app-content').append('div')
						.attr('id', 'tooltip')
						.style('display', 'none');

				// Summarise the data according to the main dimension
					var summaryRows = [];
					var mainDimIndex = queryResult.fields.map(x => x.systemName).indexOf(settings.mainDim);
					var startIndex = queryResult.fields.map(x => x.systemName).indexOf(settings.startDate);
					var endIndex = queryResult.fields.map(x => x.systemName).indexOf(settings.endDate);
					var numerIndex = queryResult.fields.map(x => x.systemName).indexOf(settings.numerator);
					var denomIndex = queryResult.fields.map(x => x.systemName).indexOf(settings.denominator);

					d3.group(queryResult.rows, d => d[mainDimIndex].formattedValue).forEach(group => {
						var summaryRow = [];
						if (group.length == 1) {
							summaryRow = summaryRow.concat(group[0]);
						}
						else {
							group[0].forEach((cell, i) => {
								switch(i) {
									case startIndex:
										var startList = group.map(x => x[startIndex].value);
										var minStart = startList.indexOf(d3.min(startList));
										summaryRow.push(group[minStart][startIndex]);
										break;
									case endIndex:
										var endList = group.map(x => x[endIndex].value);
										var maxEnd = endList.indexOf(d3.max(endList));
										summaryRow.push(group[maxEnd][endIndex]);
										break;
									case numerIndex:
										var numerSum = d3.sum(group, d => d[numerIndex].value);
										summaryRow.push({ 'value': numerSum, 'formattedValue': getFormattedValue(queryResult.fields[numerIndex].systemName, numerSum) });
										break;
									case denomIndex:
										var denomSum = d3.sum(group, d => d[denomIndex].value);
										summaryRow.push({ 'value': denomSum, 'formattedValue': getFormattedValue(queryResult.fields[denomIndex].systemName, denomSum) });
										break;
									default:
										summaryRow.push(group[0][i]);
										break;
								}
							});
						}
						
						summaryRows.push(summaryRow);
					});

				// If colour coding is set, create a legend
					if (settings.colourDim != 'None') {
						var colourDimIndex = queryResult.fields.map(x => x.systemName).indexOf(settings.colourDim);
						var colourGroups = Array.from(new Set(summaryRows.map(x => x[colourDimIndex].formattedValue)));
						var colourScale = eval('d3.interpolate' + settings.colourSet)

						var legend = d3.select('#__da-app-content').insert('div', '*')
							.attr('id', 'legend');

						var legendItems = legend.selectAll('div.legend-item')
						.data(colourGroups)
						.join('div')
							.attr('class', 'legend-item')
							.style('border-bottom-color', d => colourScale((colourGroups.indexOf(d) + 1) / colourGroups.length))
							.attr('title', d => d == '' ? 'Null' : d)
							.text(d => d == '' ? 'Null' : d);
					}

				// Create the header rows
					// Functions for generating header data
						function getLoopStart(granularity) {
							switch(granularity) {
								case 'week':
									var loopStart = new Date(queryStart.getFullYear(), queryStart.getMonth(), queryStart.getDate() - (queryStart.getDay() - settings.weekStart));
									if (loopStart > queryStart) {
										loopStart.setDate(loopStart.getDate() - 7);
									}
									return loopStart;
								case 'bi-week':
									var loopStart = new Date(queryStart.getFullYear(), queryStart.getMonth(), queryStart.getDate() - (queryStart.getDay() - settings.weekStart));
									if (parseInt(loopStart.getWeek().slice(-1)) % 2 === 0) {
										loopStart.setDate(loopStart.getDate() - 7);
									}
									if (loopStart > queryStart) {
										loopStart.setDate(loopStart.getDate() - 14);
									}
									return loopStart;
								case 'quarter':
									var loopStart = new Date(queryStart.getFullYear(), queryStart.getMonth() - (queryStart.getMonth() % 3) + (settings.yearStart % 3), 1);
									if (loopStart > queryStart) {
										loopStart.setMonth(loopStart.getMonth() - 3);
									}
									return loopStart;
							}
						}

						function timesToLoop(granularity) {
							switch(granularity) {
								case 'day':
									return daySpan;
								case 'week':
									return dayDiff(getLoopStart('week'), queryEnd) / 7;
								case 'bi-week':
									return dayDiff(getLoopStart('bi-week'), queryEnd) / 14;
								case 'month':
									return ((queryEnd.getYear() - queryStart.getYear()) * 12) + queryEnd.getMonth() - queryStart.getMonth() + 1;
								case 'quarter':
									var loopStart = getLoopStart('quarter');
									return (((queryEnd.getYear() - loopStart.getYear()) * 12) + queryEnd.getMonth() - loopStart.getMonth() + 1) / 3;
								case 'year':
									return queryEnd.getYear() - queryStart.getYear() + 1
							}
						}

						function getHeaderRow(granularity, rowNum) {
							var result = [];
							switch(granularity) {
								case 'day':
									for (i = 0; i < timesToLoop('day'); i++) {
										var thisDay = new Date(queryStart.getFullYear(), queryStart.getMonth(), queryStart.getDate() + i);
										var position = dayDiff(queryStart, thisDay);
										result.push({
											'label': thisDay.getDate(),
											'class': 'header row' + rowNum,
											'start': position,
											'span': 1
										});
									}
									return result;
								case 'week':
									var loopStart = getLoopStart('week');
									for (i = 0; i < timesToLoop('week'); i++) {
										var thisWeek = new Date(loopStart.getFullYear(), loopStart.getMonth(), loopStart.getDate() + i * 7);
										var startDate = new Date(Math.max(queryStart, thisWeek));
										var endDate = new Date(Math.min(queryEnd, new Date(thisWeek.getFullYear(), thisWeek.getMonth(), thisWeek.getDate() + 7)));
										result.push({
											'label': thisWeek.getWeek(settings.weekStart),
											'class': 'header row' + rowNum,
											'start': dayDiff(queryStart, startDate),
											'span': Math.max(1, dayDiff(startDate, endDate) - 1)
										});
									}
									return result;
								case 'bi-week':
									var loopStart = getLoopStart('bi-week');
									for (i = 0; i < timesToLoop('bi-week'); i++) {
										var thisWeek = new Date(loopStart.getFullYear(), loopStart.getMonth(), loopStart.getDate() + i * 14);
										var startDate = new Date(Math.max(queryStart, thisWeek));
										var endDate = new Date(Math.min(queryEnd, new Date(thisWeek.getFullYear(), thisWeek.getMonth(), thisWeek.getDate() + 14)));
										result.push({
											'label': thisWeek.getWeek() + '-' + new Date(thisWeek.getFullYear(), thisWeek.getMonth(), thisWeek.getDate() + 7).getWeek(),
											'class': 'header row' + rowNum,
											'start': dayDiff(queryStart, startDate),
											'span': Math.max(1, dayDiff(startDate, endDate) - 1)
										});
									}
									return result;
								case 'month':
									for (i = 0; i < timesToLoop('month'); i++) {
										var thisMonth = new Date(queryStart.getFullYear(), queryStart.getMonth() + i, 1);
										var startDate = new Date(Math.max(queryStart, thisMonth));
										var endDate = new Date(Math.min(queryEnd, new Date(thisMonth.getFullYear(), thisMonth.getMonth() + 1, 0)));
										result.push({
											'label': thisMonth.toLocaleString('default', { 'month': 'short' }),
											'class': 'header row' + rowNum,
											'start': dayDiff(queryStart, startDate),
											'span': dayDiff(startDate, endDate)
										});
									}
									return result;
								case 'quarter':
									var loopStart = getLoopStart('quarter');
									for (i = 0; i < timesToLoop('quarter'); i++) {
										var thisQuarter = new Date(loopStart.getFullYear(), loopStart.getMonth() + i * 3, 1);
										var startDate = new Date(Math.max(queryStart, thisQuarter));
										var endDate = new Date(Math.min(queryEnd, new Date(thisQuarter.getFullYear(), thisQuarter.getMonth() + 3, 0)));
										result.push({
											'label': thisQuarter.getQuarter(),
											'class': 'header row' + rowNum,
											'start': dayDiff(queryStart, startDate),
											'span': dayDiff(startDate, endDate)
										});
									}
									return result;
							}
						}

					var headers = header.selectAll('div')
						.data(() => {
							var granularity = settings.granularity;

							if (granularity == 'auto') {
								var headerBox = header.node().getBoundingClientRect();
								var targetLabels = 7;
								var daysPerLabel = daySpan / targetLabels;
								if (daysPerLabel < 2) { // 14 maximum day labels
									var pixelsPerLabel = headerBox.width / daySpan;
									granularity = pixelsPerLabel > 25 ? 'day' : 'week';
								}
								else if (daysPerLabel / 7 < 1.3) { // 9 maximum week labels
									var pixelsPerLabel = headerBox.width / (daySpan / 7);
									granularity = pixelsPerLabel > 30 ? 'week' : 'bi-week';
								}
								else if (daysPerLabel / 14 < 1) { // 7 maximum bi-week labels
									var pixelsPerLabel = headerBox.width / (daySpan / 14);
									granularity = pixelsPerLabel > 50 ? 'bi-week' : 'month';
								}
								else if (daysPerLabel / 30 < 1.8) { // 12 maximum month labels
									var pixelsPerLabel = headerBox.width / (daySpan / 30);
									granularity = pixelsPerLabel > 40 ? 'month' : 'quarter';
								}
								else {
									granularity = 'quarter';
								}
							}

							var data = [];
							switch(granularity) {
								case 'day':
									data = data.concat(getHeaderRow('month', 1));
									data = data.concat(getHeaderRow(granularity, 2));
									return data;
								case 'week':
									data = data.concat(getHeaderRow('month', 1));
									data = data.concat(getHeaderRow(granularity, 2));
									return data;
								case 'bi-week':
									data = data.concat(getHeaderRow('month', 1));
									data = data.concat(getHeaderRow(granularity, 2));
									return data;
								case 'month':
									data = data.concat(getHeaderRow('quarter', 1));
									data = data.concat(getHeaderRow(granularity, 2));
									return data;
								case 'quarter':
									data = data.concat(getHeaderRow('year', 1));
									data = data.concat(getHeaderRow(granularity, 2));
									return data;
							}
						})
						.join('div')
							.attr('class', d => d.class)
							.style('grid-column', d => d.start + ' / span ' + d.span)
							.attr('title', d => d.label)
							.text(d => d.label);

				// Create the category groups
					if (settings.groupDim != 'None') {
						var groupIndex = queryResult.fields.map(x => x.systemName).indexOf(settings.groupDim);
						var groups = body.selectAll('div')
						.data(d3.group(summaryRows, d => d[groupIndex].formattedValue))
						.join('div');
					}
					else {
						var groups = body.append('div')
							.datum([queryResult.fields[mainDimIndex].name, summaryRows]);
					}

					groups
					.attr('class', 'group')
					.style('grid-template-columns', 'repeat(' + daySpan + ', minmax(0, 1fr))')
					.append('div')
						.attr('class', 'group-name')
						.style('grid-column', '1 / span ' + daySpan)
						.text(d => d[0]);

				// Create the bars
					var bars = groups.selectAll('div.bar')
					.data(d => d[1])
					.join('div')
						.attr('class', 'bar')
						.style('background-color', d => getBarColour(d, 'bar'))
						.style('grid-column', d => {
							var dStart = d[startIndex].value.slice(4, 5) == '-' ? d[startIndex].value.replace(' ', 'T') : d[startIndex].value;
							var startDate = new Date(Math.max(queryStart, new Date(dStart)));
							var startCol = dayDiff(queryStart, startDate);

							var dEnd = d[endIndex].value.slice(4, 5) == '-' ? d[endIndex].value.replace(' ', 'T') : d[endIndex].value;
							var endDate = new Date(Math.min(queryEnd, new Date(dEnd)));
							var span = dayDiff(startDate, endDate);

							return startCol + ' / span ' + span;
						})
						.on('mouseenter', (event, d) => {
							d.forEach((item, i) => item.label = queryResult.fields[i].name);

							tooltip.style('display', 'table');

							var tooltipRows = tooltip.selectAll('div.tooltip-row')
							.data(d.filter((x, i) => settings['tooltip_' + queryResult.fields[i].systemName] ))
							.join('div')
								.attr('class', 'tooltip-row');

							var tooltipCells = tooltipRows.selectAll('div')
							.data((d, i) => { return [
								{ 'class': 'tooltip-category', 'text': d.label },
								{ 'class': 'tooltip-value', 'text': d.formattedValue }
							]; })
							.join('div')
								.attr('class', d => d.class)
								.text(d => d.text);

							var tooltipProgress = tooltip.append('div')
								.attr('class', 'tooltip-row');

							if (settings.numerator != 'None' && settings.denominator == 'None') {
								tooltipProgress.append('div')
									.attr('class', 'tooltip-category')
									.text(queryResult.fields[numerIndex].name);

								tooltipProgress.append('div')
									.attr('class', 'tooltip-value')
									.each((e, i, nodes) => {
										if (typeof(d[numerIndex].formattedValue) == 'object') {
											d[numerIndex].formattedValue.then(result => {
												d3.select(nodes[i]).text(result);
											});
										}
										else {
											d3.select(nodes[i]).text(d[numerIndex].formattedValue);
										}
									});
							}
							else {
								tooltipProgress.append('div')
									.attr('class', 'tooltip-category')
									.text('Progress');
								
								tooltipProgress.append('div')
									.attr('class', 'tooltip-value')
									.each((e, i, nodes) => {
										if (typeof(d[denomIndex].formattedValue) == 'object') {
											d[numerIndex].formattedValue.then(result => {
												d3.select(nodes[i]).text(d3.format('.0%')(d[numerIndex].value / d[denomIndex].value) + ' of ' + result);
											})
										}
										else {
											d3.select(nodes[i]).text(d3.format('.0%')(d[numerIndex].value / d[denomIndex].value) + ' of ' + d[denomIndex].formattedValue);
										}
									});
							}
						})
						.on('mousemove', (event) => {
							var widgetBox = d3.select('#__da-app-content').node().getBoundingClientRect();
							tooltip
							.style('left', event.x + (event.x > widgetBox.width / 2 ? -10 : 10) + 'px')
							.style('top', event.y + (event.y > widgetBox.height / 2 ? -10 : 10) + 'px')
							.style('transform', () => {
								var rightHalf = event.x > widgetBox.width / 2;
								var bottomHalf = event.y > widgetBox.height / 2;
								return 'translate(' + (rightHalf ? '-100%,' : '0,') + (bottomHalf ? '-100%)' : '0)');
							});
						})
						.on('mouseleave', () => {
							tooltip.style('display', 'none');
						});

					// Write the name text
						var barName = bars.append('div')
							.attr('class', 'name')
							.style('padding-bottom', settings.numerator != 'None' && settings.denominator != 'None' ? '3px' : null)
							.text(d => {
								return d[mainDimIndex].formattedValue;
							});

					// Generate the progress indicators or measurement label
						if (settings.numerator != 'None' && settings.denominator == 'None') {
							var barProgressText = bars.append('div')
								.attr('class', 'metric-text')
								.each((d, i, nodes) => {
									if (typeof(d[numerIndex].formattedValue) == 'object') {
										d[numerIndex].formattedValue.then(result => {
											d3.select(nodes[i]).text(result);
										});
									}
									else {
										d3.select(nodes[i]).text(d[numerIndex].formattedValue);
									}
								});
						}
						else if (settings.numerator != 'None' && settings.denominator != 'None') {
							var barProgressText = bars.append('div')
								.attr('class', 'progress-text')
								.style('padding-bottom', '3px')
								.each((d, i, nodes) => {
									if (d[denomIndex].value !== 0) {
										if (typeof(d[denomIndex].formattedValue) == 'object') {
											d[denomIndex].formattedValue.then(result => {
												d3.select(nodes[i]).text(d3.format('.0%')(d[numerIndex].value / d[denomIndex].value) + ' of ' + result);
											});
										}
										else {
											d3.select(nodes[i]).text(d3.format('.0%')(d[numerIndex].value / d[denomIndex].value) + ' of ' + d[denomIndex].formattedValue);
										}
									}
								});

							var progressLine = bars.append('div')
								.attr('class', 'progress-line')
								.style('border-bottom-color', d => getBarColour(d, 'line'))
								.style('width', d => {
									return d[numerIndex].value / d[denomIndex].value * 100 + '%';
								});
						}

				// Create the today line
					var today = new Date();
					if (queryStart < today && today < queryEnd) {
						var todayLine = groups.append('div')
							.attr('id', 'today-line')
							.style('left', dayDiff(queryStart, today) / daySpan * 100 + '%');
					}
			});
	}
}