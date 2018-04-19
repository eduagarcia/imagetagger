const threshold = 7;      // Threshold to draw a new drawing vs move the old one (px)
const radius = 3;         // Radius of the handles
const color = '#C00';     // The color of drawings and handles
let mousex, mousey;       // Holding the mouse position relative to the canvas

/** The parent class for drawings */
class Drawing {
  /**
   * @param parent the parent Canvas object
   * @param points initial points
   * @param mutable whether the drawing may be changed
   */
  constructor(parent, points, id, mutable) {
    /* Set fields */
    this.pointCounter = Object.keys(points).length / 2;      // The number of points that are currently set
    this.id = id;
    this.name = "drawing" + id;
    this.parent = parent;

    /* Define layer */
    let l = {
      name: this.name,
      type: 'line',
      strokeWidth: 2,
      strokeStyle: color,
    };
    $.extend(l, points);
    this.parent.addLayer(l);
    this.setMutable(mutable);
  }
  /** Used so that the line can follow the mouse */
  setCurrentPoint(x, y) {
    this.setPoint(this.pointCounter + 1, x, y);
  }

  /** Set a specific point to specified coordinates */
  setPoint(number, x, y) {
    let l = {};
    l["x" + number] = x;
    l["y" + number] = y;
    this.parent.setLayer(this.name, l);
    this.parent.updateAnnotationFields(this.parent.getLayer(this.name));
  }
  setPoints(points) {
    this.parent.setLayer(this.name, points);
  }
  /** Deletes the current point */
  deleteCurrentPoint() {
    this.pointCounter++;
    this.deletePoint(this.pointCounter);
  }

  /** Set the cursor to 'drag' or 'crosshair' in mouseover
   *
   * @param bool whether the dursor is in 'drag' style
   */
  setDragCursor(bool) {
    let l = this.parent.getLayer(this.name);
    if (l.handle && this.mutable) {
      l.handle.cursors.mouseover = bool ? 'grab' : 'crosshair';
      this.parent.setLayer(this.name, l);
    }
  }
  /** Finish the current drawing */
  close() {
    this.parent.inline = false;
    this.parent.locked = false;
    this.parent.setLayer(this.name, {
      closed: true
    });
    this.setDragCursor(true);
  }
  /** Return the points of the drawing as a JS object
   * with the properties x1, y1, x2, y2, ...
   */
  getPoints() {
    let points = {};
    let l = this.parent.getLayer(this.name);
    for (let i = 1; i <= this.pointCounter; i++) {
      points["x" + i] = l["x" + i];
      points["y" + i] = l["y" + i];
    }
    return points;
  }
  /** Return the points of the drawing as an array
   * containing an array of length two for each point
   * e.g. [[12, 41], [124, 35], ...]
   */
  getPointTuples() {
    let points = [];
    let l = this.parent.getLayer(this.name);
    for (let i = 1; i <= this.pointCounter; i++) {
      points.push([l["x" + i], l["y" + i]]);
    }
    return points;
  }

  /** ---- Public methods ---- **/

  /** Remove the drawing **/
  remove() {
    this.parent.removeLayer(this.name);
  }
  setMutable(mutable) {
    this.mutable = mutable;
    let l = this.parent.getLayer(this.name);
    if (mutable) {
      l["handle"] = {
        type: 'arc',
        fillStyle: color,
        strokeStyle: color,
        strokeWidth: 1,
        radius: radius,
        cursors: {
          mouseover: 'grab',
          mousedown: 'crosshair',
          mouseup: 'crosshair'
        }
      };
    } else {
      l["handle"] = {};
    }
    this.parent.setLayer(this.name, l);
  }
  /** Move the drawing
   *
   * @param x direction (in px) to the right
   * @param y direction (in px) to the bottom
   */
  move(x, y) {
    let l = this.parent.getLayer(this.name);
    for (let i = 1; i <= this.pointCounter; i++) {
      l["x" + i] += x;
      l["y" + i] += y;
    }
    this.parent.setLayer(this.name, l);
  }
  addPoint(x, y) {
    this.setCurrentPoint(x, y);
    this.pointCounter++;
  }
  /**
   * @param number number of the point, starting at 1
   */
  deletePoint(number) {
    let l = this.parent.getLayer(this.name);
    for (let i = number; i < this.pointCounter; i++) {
      l["x" + i] = l["x" + (i + 1)];
      l["y" + i] = l["y" + (i + 1)];
    }
    delete l["x" + this.pointCounter];
    delete l["y" + this.pointCounter];
    this.pointCounter--;
    if (this.pointCounter === 0) {
      this.remove();
    } else {
      this.parent.setLayer(this.name, l);
    }
  }
}

class Point extends Drawing {
  constructor(parent, point, id, mutable) {
    super(parent, point, id, mutable);
    this.close();
  }
}

class Line extends Drawing {
  addPoint(x, y) {
    this.pointCounter++;
    if (this.pointCounter === 2) {
      this.setPoint(2, x, y);
      this.close();
    }
  }
}

class Polygon extends Drawing {
  /**
   * @param numberOfPoints The number of points the polygon will have
   */
  constructor(parent, points, id, mutable, numberOfPoints) {
    super(parent, points, id, mutable);
    this.nop = numberOfPoints;
  }
  addPoint(x, y) {
    super.addPoint(x, y);
    if (this.pointCounter >= this.nop) {
      this.close();
    }
  }
}

/** Polygons with an arbitrary number of points
 *
 * Clicking on the first point will finish the drawing.
 */
class ArbitraryPolygon extends Drawing {
  addPoint(x, y) {
    let firstPoint = this.getPointTuples()[0];
    if (Math.abs(firstPoint[0] - mousex) < threshold &&
      Math.abs(firstPoint[1] - mousey) < threshold) {
      this.deleteCurrentPoint();
      this.close();
    } else {
      super.addPoint(x, y);
    }
  }
}


class Canvas {
  constructor(HTMLCanvas, vector_type, node_count, mutable) {
    this.canvas = HTMLCanvas;
    this.width = this.canvas.width();
    this.height = this.canvas.height();
    this.offset = this.canvas.offset();
    this.inline = false;            // True if we are currently drawing a drawing
    this.locked = false;            // True if clicking should not create a new line
    this.mutable = mutable === undefined ? true : mutable;        // Whether we can draw on the canvas with the mouse
    this.vector_type = vector_type;
    this.node_count = node_count;
    this.currentDrawing = null;     // The drawing we are currently drawing
    this.drawings = [];             // Array holding all the drawings
    let self = this;
    $('body').mousemove(function (event) {
      mousex = event.pageX - self.offset.left;
      mousey = event.pageY - self.offset.top;
      if (self.inline && self.currentDrawing) {
        self.currentDrawing.setCurrentPoint(mousex, mousey);
      }
      if (self.currentDrawing) {
        self.updateAnnotationFields(self.getLayer(self.currentDrawing.name));
      }
    }).click(function (event) {
      mousex = event.pageX - self.offset.left;
      mousey = event.pageY - self.offset.top;
      if (self.inline && self.currentDrawing) {
        if (mousex <= self.width && mousex >= 0 &&
          mousey <= self.height && mousey >= 0) {
          // We are currently drawing a drawing
          // and we clicked inside of the canvas:
          // add a point
          self.currentDrawing.addPoint(mousex, mousey);
        }
      } else if (self.locked) {
        // we do not create a drawing because we are
        // only moving an existing one
        self.locked = false;
      } else if (self.mutable) {
        if (mousex <= self.width && mousex >= 0 &&
          mousey <= self.height && mousey >= 0) {
          // We clicked and are inside the canvas:
          // start drawing a new one
          if (self.currentDrawing) {
            self.currentDrawing.remove();
          }
          switch (self.vector_type) {
            case 2: // Point
              self.drawPointMouse();
              break;
            case 3: // Line
              self.drawLineMouse();
              break;
            case 5: // Polygon
              if (self.node_count === 0) {
                self.drawArbitraryPolygonMouse();
              } else {
                self.drawArbitraryPolygonMouse();
              }
              break;
            default:
              console.log("No appropriate drawing found for vector type " + self.vector_type);
          }
        }
      }
    }).mousedown(function () {
      // Check if we are close enough to move the point, not draw a new drawing
      // we use the variable locked which is checked when we can create a new line
      if (self.mouseTooClose()) {
        self.locked = true;
      }
    });
  }

  mouseTooClose() {
    for (let drawing of this.drawings) {
      let points = drawing.getPointTuples();
      for (let point of points) {
        if (Math.abs(point[0] - mousex) < threshold && Math.abs(point[1] - mousey) < threshold) {
          return true;
        }
      }
    }
    return false;
  }

  addLayer(l) {
    this.canvas.addLayer(l).drawLayers();
  }

  setLayer(name, l) {
    this.canvas.setLayer(name, l).drawLayers();
  }

  getLayer(name) {
    return this.canvas.getLayer(name);
  }

  removeLayer(name) {
    this.canvas.removeLayer(name).drawLayers();
    this.drawings = this.drawings.filter(function (d) {
      return d.name !== name;
    });
  }

  drawPointMouse() {
    this.inline = true;
    this.drawPoint({x1: mousex, y1: mousey}, true);
    this.currentDrawing.setDragCursor(false);
  }

  drawLineMouse() {
    this.inline = true;
    this.drawLine({x1: mousex, y1: mousey}, 0, true);
    this.currentDrawing.setDragCursor(false);
  }

  drawPolygonMouse(numberOfPoints) {
    this.inline = true;
    this.drawPolygon({x1: mousex, y1: mousey}, true, numberOfPoints, false);
    this.currentDrawing.setDragCursor(false);
  }

  drawArbitraryPolygonMouse() {
    this.inline = true;
    this.drawArbitraryPolygon({x1: mousex, y1: mousey}, true, false);
    this.currentDrawing.setDragCursor(false);
  }

  /** ---- Public methods ---- **/

  clear() {
    for (let d of this.drawings) {
      d.remove();
    }
  }

  reset() {
    this.clear();
    $('body').off('click');
  }

  drawPoint(points, id, mutable) {
    this.currentDrawing = new Point(this, points, id, mutable);
    this.drawings.push(this.currentDrawing);
  }

  drawLine(points, id, mutable) {
    this.currentDrawing = new Line(this, points, id, mutable);
    this.drawings.push(this.currentDrawing);
  }

  drawPolygon(points, id, mutable, numberOfPoints, closed) {
    this.currentDrawing = new Polygon(this, points, id, mutable, numberOfPoints);
    if (closed) {
      this.currentDrawing.close();
    }
    this.drawings.push(this.currentDrawing);
  }

  drawArbitraryPolygon(points, id, mutable, closed) {
    this.currentDrawing = new ArbitraryPolygon(this, points, id, mutable);
    if (closed) {
      this.currentDrawing.close();
    }
    this.drawings.push(this.currentDrawing);
  }

  drawExistingAnnotations(annotations) {
    let currentAnnotationType = parseInt($('#annotation_type_id').val());
    this.clear();
    for (let annotation of annotations) {
      if (annotation.annotation_type.id !== currentAnnotationType) {
        continue;
      }
      if (annotation.vector === null) {
        continue;
      }
      switch (annotation.annotation_type.vector_type) {
        case 1: // Ball
          console.log("Bounding boxes should be used for this");
        case 2: // Points
          this.drawPoint(annotation.vector, annotation.id);
          break;
        case 3: // Lines
          this.drawLine(annotation.vector, annotation.id, false);
          break;
        case 5: // Polygons
          if (annotation.annotation_type.node_count === 0) {
            this.drawArbitraryPolygon(annotation.vector, annotation.id, false, true);
          } else {
            this.drawPolygon(annotation.vector, annotation.id, annotation.annotation_type.node_count, false, true);
          }
          break;
        default:
          console.log("Unknown vector type: " + annotation.annotation_type.vector_type);
      }
    }
    this.currentDrawing = undefined;
  }

  updateAnnotationFields(drawing) {
    // TODO: should also change on drag
    $('#x1Field').val(Math.round(drawing.x1 * globals.imageScale));
    $('#y1Field').val(Math.round(drawing.y1 * globals.imageScale));
    $('#x2Field').val(Math.round(drawing.x2 * globals.imageScale));
    $('#y2Field').val(Math.round(drawing.y2 * globals.imageScale));
    $('#not_in_image').prop('checked', false).change();
  }

  getDrawingById(id) {
    for (let drawing of this.drawings) {
      if (drawing.id === id) {
        return drawing;
      }
    }
  }

  resetSelection(abortEdit) {
    $('.annotation_value').val(0);
    // Make every drawing immutable
    for (let drawing of this.drawings) {
      drawing.setMutable(false);
    }
    if (abortEdit === true) {
      globals.editedAnnotationId = undefined;
      $('.annotation').removeClass('alert-info');
      globals.editActiveContainer.addClass('hidden');
      if (this.old && this.currentDrawing) {
        this.currentDrawing.setPoints(this.old);
        this.old = undefined;
      } else if (this.currentDrawing) {
        this.currentDrawing.remove();
      }
      this.currentDrawing = undefined;
    }
  }

  cancelSelection() {
  }

  initSelection() {
    this.initialized = true;
  }

  restoreSelection() {
  }

  reloadSelection(annotation_id) {
    // Make annotation_id mutable
    this.currentDrawing = this.getDrawingById(annotation_id);
    this.currentDrawing.setMutable(true);
    this.old = this.currentDrawing.getPoints();
    this.updateAnnotationFields(this.getLayer(this.currentDrawing.name));
  }

  validate_vector(vector) {
    return true;
  }
  moveSelectionLeft() {
    this.currentDrawing.move(-globals.moveSelectionStepSize, 0);
    this.updateAnnotationFields(this.getLayer(this.currentDrawing.name));
  }
  moveSelectionRight() {
    this.currentDrawing.move(globals.moveSelectionStepSize, 0);
    this.updateAnnotationFields(this.getLayer(this.currentDrawing.name));
  }
  moveSelectionUp() {
    this.currentDrawing.move(0, -globals.moveSelectionStepSize);
    this.updateAnnotationFields(this.getLayer(this.currentDrawing.name));
  }
  moveSelectionDown() {
    this.currentDrawing.move(0, globals.moveSelectionStepSize);
    this.updateAnnotationFields(this.getLayer(this.currentDrawing.name));
  }
  decreaseSelectionSizeLeft() {}
  decreaseSelectionSizeRight() {}
  decreaseSelectionSizeUp() {}
  decreaseSelectionSizeDown() {}

}
