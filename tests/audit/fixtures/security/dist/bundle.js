// AUD-R04: vulnerability shipped inside a build output directory.
export function run(userInput) {
  return eval(userInput);
}
