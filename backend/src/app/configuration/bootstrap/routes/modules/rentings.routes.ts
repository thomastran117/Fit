import { containerTokens } from "@/configuration/bootstrap/container";
import type { RentingsController } from "@/features/rentings/rentings.controller";
import type { RouteModule } from "@/configuration/bootstrap/routes/types";

export const rentingsRouteModule: RouteModule = {
  id: "rentings",
  register(app, { resolveHandler }) {
    app.post(
      "/booking-requests/:id/convert",
      resolveHandler<RentingsController>(containerTokens.rentingsController, "convertBookingRequest"),
    );
    app.get(
      "/rentings/me",
      resolveHandler<RentingsController>(containerTokens.rentingsController, "listMine"),
    );
    app.get(
      "/rentings/:id",
      resolveHandler<RentingsController>(containerTokens.rentingsController, "getById"),
    );
  },
};
