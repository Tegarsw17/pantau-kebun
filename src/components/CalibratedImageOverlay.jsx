import { useEffect, useRef, useState } from "react";
import { useMap } from "react-leaflet";

const EPSILON = 1e-10;
const DEFAULT_IMAGE_SIZE = {
  width: 1600,
  height: 900,
};

function solveLinearSystem(coefficients, values) {
  const size = values.length;
  const augmentedMatrix = coefficients.map((row, index) => [...row, values[index]]);

  for (let column = 0; column < size; column += 1) {
    let pivotRow = column;

    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(augmentedMatrix[row][column]) > Math.abs(augmentedMatrix[pivotRow][column])) {
        pivotRow = row;
      }
    }

    if (Math.abs(augmentedMatrix[pivotRow][column]) < EPSILON) {
      return null;
    }

    if (pivotRow !== column) {
      [augmentedMatrix[column], augmentedMatrix[pivotRow]] = [
        augmentedMatrix[pivotRow],
        augmentedMatrix[column],
      ];
    }

    const pivotValue = augmentedMatrix[column][column];

    for (let cursor = column; cursor <= size; cursor += 1) {
      augmentedMatrix[column][cursor] /= pivotValue;
    }

    for (let row = 0; row < size; row += 1) {
      if (row === column) {
        continue;
      }

      const factor = augmentedMatrix[row][column];

      for (let cursor = column; cursor <= size; cursor += 1) {
        augmentedMatrix[row][cursor] -= factor * augmentedMatrix[column][cursor];
      }
    }
  }

  return augmentedMatrix.map((row) => row[size]);
}

function buildProjectiveTransformMatrix(imageSize, destinationPoints) {
  const sourcePoints = [
    [0, 0],
    [imageSize.width, 0],
    [imageSize.width, imageSize.height],
    [0, imageSize.height],
  ];
  const coefficients = [];
  const outputs = [];

  sourcePoints.forEach(([sourceX, sourceY], index) => {
    const destinationPoint = destinationPoints[index];

    coefficients.push([
      sourceX,
      sourceY,
      1,
      0,
      0,
      0,
      -destinationPoint.x * sourceX,
      -destinationPoint.x * sourceY,
    ]);
    outputs.push(destinationPoint.x);

    coefficients.push([
      0,
      0,
      0,
      sourceX,
      sourceY,
      1,
      -destinationPoint.y * sourceX,
      -destinationPoint.y * sourceY,
    ]);
    outputs.push(destinationPoint.y);
  });

  const solution = solveLinearSystem(coefficients, outputs);

  if (solution == null) {
    return null;
  }

  return [
    solution[0],
    solution[3],
    0,
    solution[6],
    solution[1],
    solution[4],
    0,
    solution[7],
    0,
    0,
    1,
    0,
    solution[2],
    solution[5],
    0,
    1,
  ];
}

function formatMatrix3d(matrixValues) {
  return `matrix3d(${matrixValues
    .map((value) => Number(value.toFixed(12)))
    .join(",")})`;
}

function buildBoundingRect(points) {
  const xValues = points.map((point) => point.x);
  const yValues = points.map((point) => point.y);
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);

  return {
    height: Math.max(maxY - minY, 1),
    minX,
    minY,
    width: Math.max(maxX - minX, 1),
  };
}

export function CalibratedImageOverlay({ corners, imageUrl, opacity = 1 }) {
  const map = useMap();
  const frameRef = useRef(0);
  const imageElementRef = useRef(null);
  const [imageSize, setImageSize] = useState(DEFAULT_IMAGE_SIZE);

  useEffect(() => {
    const imageElement = document.createElement("img");

    imageElement.alt = "";
    imageElement.className = "calibrated-image-overlay";
    imageElement.decoding = "async";
    imageElement.draggable = false;
    imageElement.src = imageUrl;
    imageElement.style.height = `${DEFAULT_IMAGE_SIZE.height}px`;
    imageElement.style.left = "0";
    imageElement.style.maxWidth = "none";
    imageElement.style.opacity = String(opacity);
    imageElement.style.pointerEvents = "none";
    imageElement.style.position = "absolute";
    imageElement.style.top = "0";
    imageElement.style.transformOrigin = "0 0";
    imageElement.style.userSelect = "none";
    imageElement.style.visibility = "hidden";
    imageElement.style.width = `${DEFAULT_IMAGE_SIZE.width}px`;
    imageElement.style.webkitUserDrag = "none";
    imageElement.style.willChange = "transform";

    const handleImageLoad = () => {
      const nextImageSize =
        imageElement.naturalWidth > 0 && imageElement.naturalHeight > 0
          ? {
              width: imageElement.naturalWidth,
              height: imageElement.naturalHeight,
            }
          : DEFAULT_IMAGE_SIZE;

      setImageSize(nextImageSize);
      imageElement.style.visibility = "visible";
    };

    imageElement.addEventListener("load", handleImageLoad);

    if (imageElement.complete) {
      handleImageLoad();
    }

    map.getPanes().overlayPane.appendChild(imageElement);
    imageElementRef.current = imageElement;

    return () => {
      window.cancelAnimationFrame(frameRef.current);
      imageElement.removeEventListener("load", handleImageLoad);
      imageElement.remove();
      imageElementRef.current = null;
    };
  }, [imageUrl, map, opacity]);

  useEffect(() => {
    if (imageElementRef.current) {
      imageElementRef.current.style.opacity = String(opacity);
    }
  }, [opacity]);

  useEffect(() => {
    if (imageElementRef.current == null || corners.length !== 4) {
      return undefined;
    }

    const syncOverlayTransform = () => {
      const imageElement = imageElementRef.current;

      if (imageElement == null) {
        return;
      }

      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = window.requestAnimationFrame(() => {
        const destinationPoints = corners.map((corner) =>
          map.latLngToLayerPoint([corner.lat, corner.lng]),
        );
        const transformMatrix = buildProjectiveTransformMatrix(imageSize, destinationPoints);

        imageElement.style.width = `${imageSize.width}px`;
        imageElement.style.height = `${imageSize.height}px`;

        if (transformMatrix == null) {
          const fallbackRect = buildBoundingRect(destinationPoints);

          imageElement.style.transform = `translate3d(${fallbackRect.minX}px, ${fallbackRect.minY}px, 0)`;
          imageElement.style.width = `${fallbackRect.width}px`;
          imageElement.style.height = `${fallbackRect.height}px`;
          return;
        }

        imageElement.style.transform = formatMatrix3d(transformMatrix);
      });
    };

    syncOverlayTransform();
    map.on("move", syncOverlayTransform);
    map.on("resize", syncOverlayTransform);
    map.on("viewreset", syncOverlayTransform);
    map.on("zoom", syncOverlayTransform);

    return () => {
      window.cancelAnimationFrame(frameRef.current);
      map.off("move", syncOverlayTransform);
      map.off("resize", syncOverlayTransform);
      map.off("viewreset", syncOverlayTransform);
      map.off("zoom", syncOverlayTransform);
    };
  }, [corners, imageSize, map]);

  return null;
}
