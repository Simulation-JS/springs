import "./root.css";
import {
  Simulation,
  Color,
  Circle,
  Vector,
  distance,
  frameLoop,
  Line,
  pythag,
  radToDeg,
} from "simulationjs";
import { ChangeEvent, createState, onPageMount } from "@jacksonotto/lampjs";

const Root = () => {
  const k = createState(2);
  const springLength = createState(40);

  class RopeNode extends Circle {
    velocity = new Vector(0, 0);
    bounds: Vector;
    mass = 10;
    constructor(pos: Vector, bounds: Vector) {
      const color = new Color(0, 0, 0);
      super(pos, 4, color);
      this.bounds = bounds;
    }

    accelerate(vec: Vector) {
      this.velocity.add(vec);
    }

    onFrame() {
      this.move(this.velocity);
      this.velocity = dampenVelocity(this.velocity);
      if (this.pos.y + this.radius > this.bounds.y) {
        this.pos.y = this.bounds.y - this.radius;
        this.velocity.y *= -0.76;
      } else if (this.pos.y - this.radius < 0) {
        this.pos.y = this.radius;
        this.velocity.y *= -0.76;
      }

      if (this.pos.x + this.radius > this.bounds.x) {
        this.pos.x = this.bounds.x - this.radius;
        this.velocity.x *= -0.76;
      } else if (this.pos.x - this.radius < 0) {
        this.pos.x = this.radius;
        this.velocity.x *= -0.76;
      }
    }
  }

  function dampenVelocity(vel: Vector) {
    return vel.multiply(0.96);
  }

  onPageMount(() => {
    const canvas = new Simulation("canvas");
    if (!canvas.canvas) return;

    canvas.fitElement();
    canvas.start();

    const nodes = generateNodes(5, canvas.width, canvas.height);
    const lines = generateLines(nodes);

    lines.forEach((line) => {
      canvas.add(line);
    });

    nodes.forEach((node) => {
      canvas.add(node);
    });

    let dragIndex: number | null = null;
    let prevDragPos = new Vector(0, 0);
    let prevDiff = new Vector(0, 0);

    frameLoop(() => {
      nodes.forEach((node, index) => {
        if (index === 0) return;
        if (dragIndex === index) return;
        const a = getForce(nodes, index);
        a.divide(node.mass);
        node.accelerate(a);
      });
    })();

    canvas.on("mousedown", (e: MouseEvent) => {
      prevDragPos = new Vector(e.offsetX, e.offsetY);
      dragIndex = getMinDistIndex(nodes, prevDragPos);

      if (!dragIndex) return;

      nodes[dragIndex].velocity = new Vector(0, 0);
    });

    canvas.on("mouseup", () => {
      if (dragIndex === null) return;

      nodes[dragIndex].velocity = prevDiff;

      dragIndex = null;
    });

    canvas.on("mousemove", (e: MouseEvent) => {
      if (dragIndex === null) return;

      const diff = new Vector(e.offsetX, e.offsetY);
      diff.sub(prevDragPos);

      nodes[dragIndex].move(diff);

      prevDragPos.x = e.offsetX;
      prevDragPos.y = e.offsetY;
      prevDiff = diff;
    });
  });

  function getForce(nodes: RopeNode[], index: number) {
    let force = new Vector(0, 9.8);

    if (index > 0) {
      const distX = nodes[index].pos.x - nodes[index - 1].pos.x;
      const distY = nodes[index].pos.y - nodes[index - 1].pos.y;
      const rotation = Math.atan2(distY, distX);
      const kVec = new Vector(-k().value, 0).rotate(radToDeg(rotation));
      kVec.multiply(pythag(distX, distY) - springLength().value);
      force.add(kVec);
    }

    if (index < nodes.length - 1) {
      const distX = nodes[index].pos.x - nodes[index + 1].pos.x;
      const distY = nodes[index].pos.y - nodes[index + 1].pos.y;
      const rotation = Math.atan2(distY, distX);
      const kVec = new Vector(-k().value, 0).rotate(radToDeg(rotation));
      kVec.multiply(pythag(distX, distY) - springLength().value);
      force.add(kVec);
    }

    force.multiply(0.96);
    return force;
  }

  function getMinDistIndex(nodes: RopeNode[], pos: Vector) {
    let currentDist = distance(nodes[0].pos, pos);
    let currentIndex = 0;

    nodes.forEach((node, index) => {
      if (index === 0) return;

      const dist = distance(node.pos, pos);
      if (dist < currentDist) {
        currentDist = dist;
        currentIndex = index;
      }
    });

    return currentIndex < 0 ? null : currentIndex;
  }

  function generateLines(nodes: RopeNode[]) {
    const res: Line[] = [];

    for (let i = 0; i < nodes.length - 1; i++) {
      const line = new Line(
        nodes[i].pos,
        nodes[i + 1].pos,
        new Color(0, 0, 0),
        4
      );
      res.push(line);
    }

    return res;
  }

  function generateNodes(num: number, width: number, height: number) {
    const res: RopeNode[] = [];

    const padding = 120;
    for (let i = 0; i < num; i++) {
      const pos = new Vector(width / 2, springLength().value * i + padding);
      res.push(new RopeNode(pos, new Vector(width, height)));
    }

    return res;
  }

  const handleKChange = (e: ChangeEvent<HTMLInputElement>) => {
    k(+e.currentTarget.value);
  };

  const handleLengthChange = (e: ChangeEvent<HTMLInputElement>) => {
    springLength(+e.currentTarget.value);
  };

  return (
    <>
      <div class="controls">
        <h1>Controls</h1>
        <div>
          <label for="k-input">K</label>
          <input
            id="k-input"
            value={k()}
            onChange={handleKChange}
            type="range"
            min={0.1}
            step={0.1}
            max={6}
          />
        </div>
        <div>
          <label for="length-input">Spring Length</label>
          <input
            id="length-input"
            value={springLength()}
            onChange={handleLengthChange}
            min={0}
            max={200}
            type="range"
          />
        </div>
      </div>
      <canvas id="canvas" />
    </>
  );
};

export default Root;
