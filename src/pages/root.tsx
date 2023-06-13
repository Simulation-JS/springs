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
  SceneCollection,
  randInt,
} from "simulationjs";
import {
  ChangeEvent,
  createEffect,
  createState,
  onPageMount,
} from "@jacksonotto/lampjs";

const Root = () => {
  const k = createState(2);
  const springLength = createState(40);
  const numNodes = createState(4);
  const hasGravity = createState(true);
  const nodeMass = createState(10);
  const isNonLinear = createState(false);
  let stationaryIndexes = new Set([0]);

  let connections: number[][] = createConnections(numNodes().value);

  function createConnections(numNodes: number) {
    const res: number[][] = [];

    if (isNonLinear().value) {
      for (let i = 0; i < numNodes; i++) {
        const nodeConnections: number[] = [];
        for (let j = 0; j < numNodes; j++) {
          if (i === j) continue;
          nodeConnections.push(j);
        }
        res.push(nodeConnections);
      }
    } else {
      for (let i = 0; i < numNodes; i++) {
        const nodeConnections: number[] = [];

        if (i > 0) {
          nodeConnections.push(i - 1);
        }

        if (i < numNodes - 1) {
          nodeConnections.push(i + 1);
        }

        res.push(nodeConnections);
      }
    }

    return res;
  }

  class SpringNode extends Circle {
    velocity = new Vector(0, 0);
    bounds: Vector;
    mass: number;
    constructor(pos: Vector, mass: number, bounds: Vector) {
      const color = new Color(0, 0, 0);
      super(pos, 4, color);
      this.bounds = bounds;
      this.mass = mass;
    }

    setMass(newMass: number) {
      this.mass = newMass;
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

    const nodesCol = new SceneCollection("nodes");
    const linesCol = new SceneCollection("lines");

    canvas.add(nodesCol);
    canvas.add(linesCol);

    let nodes = generateNodes(numNodes().value, canvas.width, canvas.height);
    let lines = generateLines(nodes, connections);

    function applyToCanvas() {
      linesCol.empty();
      nodesCol.empty();

      lines.forEach((line) => {
        linesCol.add(line);
      });

      nodes.forEach((node) => {
        nodesCol.add(node);
      });
    }

    applyToCanvas();

    createEffect(() => {
      nodes = generateNodes(numNodes().value, canvas.width, canvas.height);
      connections = createConnections(numNodes().value);
      lines = generateLines(nodes, connections);

      applyToCanvas();
    }, [numNodes]);

    createEffect(() => {
      nodes.forEach((node) => {
        node.setMass(nodeMass().value);
      });
    }, [nodeMass]);

    createEffect(() => {
      connections = createConnections(numNodes().value);
      lines = generateLines(nodes, connections);

      applyToCanvas();
    }, [isNonLinear]);

    let dragIndex: number | null = null;
    let prevDragPos = new Vector(0, 0);
    let prevDiff = new Vector(0, 0);
    let holdingShift = false;

    frameLoop(() => {
      nodes.forEach((node, index) => {
        if (stationaryIndexes.has(index)) return;
        if (dragIndex === index) return;
        const a = getForce(nodes, index, connections[index]);
        a.divide(node.mass);
        node.accelerate(a);
      });
    })();

    addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Shift") {
        holdingShift = true;
      }
    });

    addEventListener("keyup", (e: KeyboardEvent) => {
      if (e.key === "Shift") {
        holdingShift = false;
      }
    });

    canvas.on("mousedown", (e: MouseEvent) => {
      const point = new Vector(e.offsetX, e.offsetY);
      if (holdingShift) {
        const index = getMinDistIndex(nodes, point);

        if (index === null) return;

        if (stationaryIndexes.has(index)) {
          stationaryIndexes.delete(index);
        } else {
          stationaryIndexes.add(index);
        }

        return;
      }

      prevDragPos = point;
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

  function getForce(
    nodes: SpringNode[],
    index: number,
    otherIndexes: number[]
  ) {
    const gravityDampen = 10;
    let force = new Vector(
      0,
      hasGravity().value ? (9.8 * nodes[index].mass) / gravityDampen : 0
    );

    otherIndexes.forEach((other) => {
      const distX = nodes[index].pos.x - nodes[other].pos.x;
      const distY = nodes[index].pos.y - nodes[other].pos.y;
      const rotation = Math.atan2(distY, distX);
      const kVec = new Vector(-k().value, 0).rotate(radToDeg(rotation));
      kVec.multiply(pythag(distX, distY) - springLength().value);
      force.add(kVec);
    });

    force.multiply(0.96);
    return force;
  }

  function getMinDistIndex(nodes: SpringNode[], pos: Vector) {
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

  function generateLines(nodes: SpringNode[], connections: number[][]) {
    const lineSet = new Set<number[]>();
    const res: Line[] = [];

    for (let i = 0; i < connections.length; i++) {
      for (let j = 0; j < connections[i].length; j++) {
        if (lineSet.has([i, j])) continue;

        const line = new Line(
          nodes[i].pos,
          nodes[connections[i][j]].pos,
          new Color(0, 0, 0),
          4
        );

        lineSet.add([i, j]);
        res.push(line);
      }
    }

    return res;
  }

  function generateNodes(num: number, width: number, height: number) {
    const res: SpringNode[] = [];

    const padding = 120;
    for (let i = 0; i < num; i++) {
      const variationScale = 10;
      let variation = i > 0 ? Math.random() - 0.5 : 0;
      variation *= variationScale;
      const pos = new Vector(
        width / 2 + variation,
        springLength().value * i + padding
      );
      res.push(
        new SpringNode(pos, nodeMass().value, new Vector(width, height))
      );
    }

    return res;
  }

  const handleKChange = (e: ChangeEvent<HTMLInputElement>) => {
    k(+e.currentTarget.value);
  };

  const handleLengthChange = (e: ChangeEvent<HTMLInputElement>) => {
    springLength(+e.currentTarget.value);
  };

  const handleNumNodesChange = (e: ChangeEvent<HTMLInputElement>) => {
    numNodes(+e.currentTarget.value);
  };

  const handleGravityChange = () => {
    hasGravity((prev) => !prev);
  };

  const handleMassChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newMass = +e.currentTarget.value;
    nodeMass(newMass);
  };

  const randomizeSettings = () => {
    const newK = Math.random() * 4 + 2;
    const newLength = randInt(200);
    const numberOfNodes = randInt(7, 3);
    const newMass = randInt(995, 5);
    const newHasGravity = Math.random() > 0.5;

    if (!newHasGravity) {
      stationaryIndexes = new Set([]);
    } else {
      stationaryIndexes = new Set([0]);
    }

    k(newK);
    springLength(newLength);
    numNodes(numberOfNodes);
    nodeMass(newMass);
    hasGravity(newHasGravity);
  };

  const handleIsNonLinearChange = () => {
    isNonLinear((prev) => !prev);
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
        <div>
          <label for="node-input">Number of Nodes</label>
          <input
            id="node-input"
            value={numNodes()}
            onChange={handleNumNodesChange}
            min={1}
            max={20}
            type="range"
          />
        </div>
        <div>
          <label for="mass-input">Mass of Nodes</label>
          <input
            id="mass-input"
            value={nodeMass()}
            onChange={handleMassChange}
            min={5}
            max={1000}
            type="range"
          />
        </div>
        <div>
          <label for="gravity-input">Gravity</label>
          <input
            id="gravity-input"
            checked={hasGravity()}
            onChange={handleGravityChange}
            type="checkbox"
          />
        </div>
        <div>
          <label for="is-shape-input">Is Shape</label>
          <input
            id="is-shape-input"
            checked={isNonLinear()}
            onChange={handleIsNonLinearChange}
            type="checkbox"
          />
        </div>
        <button onClick={randomizeSettings}>Randomize</button>
        <details>
          <summary>Directions</summary>
          <span>
            <ul>
              <li>
                Hold <code>Shift</code> and click to toggle a point as
                stationary.
              </li>
              <li>Click and drag to drag a point.</li>
              <li>
                While dragging a point, releasing while in motion will add
                velocity to the point.
              </li>
              <li>
                Change settings for different behavior, if the shape/spring
                becomes unstable, bring <code>k</code> all the way down and
                slowly increase.
              </li>
            </ul>
          </span>
        </details>
      </div>
      <canvas id="canvas" />
    </>
  );
};

export default Root;
