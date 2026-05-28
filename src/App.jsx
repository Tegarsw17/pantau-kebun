import { RouterProvider } from "@tanstack/react-router";
import { Toaster } from "sonner";
import "sonner/dist/styles.css";
import "sweetalert2/dist/sweetalert2.min.css";
import { router } from "./router.jsx";

function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Toaster richColors position="top-right" theme="dark" />
    </>
  );
}

export default App;
