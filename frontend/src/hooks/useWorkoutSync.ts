import { useEffect, useState, useSyncExternalStore } from "react";
import { SyncController } from "../sync/controller";

export function useWorkoutSync(ready: boolean) {
  const [controller] = useState(() => new SyncController());
  const view = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  useEffect(() => {
    if (!ready) return;
    controller.start();
    return controller.stop;
  }, [controller, ready]);
  return { ...view, retry: controller.retry, enable: controller.enable, sessionChanged: controller.sessionChanged };
}
export type WorkoutSync = ReturnType<typeof useWorkoutSync>;
