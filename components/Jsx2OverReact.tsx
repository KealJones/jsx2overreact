import { jsx2OverReact } from "../utils/jsx2overreact-generator.ts";
import React from 'react';

export default function Jsx2OverReactConvert(props: Record<never, never>) {
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const outputRef = React.useRef<HTMLTextAreaElement>(null);
  const runJsx2Or = React.useCallback(() => {
    const inputJSX = inputRef.current?.value;
    if (outputRef.current && inputJSX) {
      outputRef.current.value = jsx2OverReact(inputJSX);
    }
  }, [inputRef.current?.value]);
  return (
    <div style={{width: '100%', height: '100%', position: 'relative', display: 'flex', alignItems: 'stretch', justifyContent: 'space-evenly', flexDirection: 'row'}}>
      <textarea style={{flex: 1, background: '#1c2834', color: '#fff'}} ref={inputRef}>
      {`<Card sx={{ minWidth: 275 }}>
      <CardContent>
        <Typography sx={{ fontSize: 14 }} color="text.secondary" gutterBottom>
          Word of the Day
        </Typography>
        <Typography variant="h5" component="div">
          be•nev•o•lent
        </Typography>
        <Typography sx={{ mb: 1.5 }} color="text.secondary">
          adjective
        </Typography>
        <Typography variant="body2">
          well meaning and kindly.
          <br />
          {'"a benevolent smile"'}
        </Typography>
      </CardContent>
      <CardActions>
        <Button size="small">Learn More</Button>
      </CardActions>
    </Card>`}
      </textarea>
      <button style={{padding: '5px'}} onClick={runJsx2Or}>CONVERT!</button>
      <textarea style={{flex: 1, background: '#1c2834', color: '#fff'}} ref={outputRef}></textarea>
    </div>
  );
}
