import { useEffect, useState } from "react";
import { AdminOrchardWorkspace } from "../components/AdminOrchardWorkspace.jsx";
import { AdminPageFrame } from "../components/AdminPageFrame.jsx";
import { getAdminPersistenceMode } from "../data/adminOrchardSupabase.js";
import { loadAdminOrchardWorkspace } from "../data/loadAdminOrchardWorkspace.js";

export function AdminOrchardPage() {
  const [workspaceSnapshot, setWorkspaceSnapshot] = useState({
    dataSource: getAdminPersistenceMode(),
    imageCalibration: null,
    imageBounds: null,
    loadState: "loading",
    mappedTrees: [],
    unmappedTrees: [],
  });

  useEffect(() => {
    let isMounted = true;

    loadAdminOrchardWorkspace()
      .then((snapshot) => {
        if (!isMounted) {
          return;
        }

        setWorkspaceSnapshot({
          dataSource: snapshot.dataSource,
          imageCalibration: snapshot.imageCalibration,
          imageBounds: snapshot.imageBounds,
          loadState: "ready",
          mappedTrees: snapshot.mappedTrees,
          unmappedTrees: snapshot.unmappedTrees,
        });
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setWorkspaceSnapshot({
          dataSource: getAdminPersistenceMode(),
          imageCalibration: null,
          imageBounds: null,
          loadState: "error",
          mappedTrees: [],
          unmappedTrees: [],
        });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <AdminPageFrame
      summary="Coordinate setup workspace for static garden calibration and tree plotting."
      title="Admin Orchard"
    >
      <AdminOrchardWorkspace
        dataSource={workspaceSnapshot.dataSource}
        imageCalibration={workspaceSnapshot.imageCalibration}
        imageBounds={workspaceSnapshot.imageBounds}
        loadState={workspaceSnapshot.loadState}
        mappedTrees={workspaceSnapshot.mappedTrees}
        unmappedTrees={workspaceSnapshot.unmappedTrees}
      />
    </AdminPageFrame>
  );
}
