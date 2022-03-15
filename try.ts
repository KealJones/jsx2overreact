import { jsx2OverReact } from "./index.ts";

const jsx = `<TextField id="outlined-basic" label="Outlined" variant="outlined" />
<TextField id="filled-basic" label="Filled" variant="filled" />
<TextField id="standard-basic" label="Standard" variant="standard" />`;

console.log(jsx2OverReact(jsx))