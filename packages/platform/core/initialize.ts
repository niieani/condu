import { loadProject } from "../cli/loadProject.js";
import { register } from "../di/di.js";

export const initialize = () => {
  register({ loadProject });
};
