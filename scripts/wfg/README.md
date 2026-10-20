# WFG chart converters

The clarinet and oboe fingering tables (`src/instruments/clarinetBoehm`,
`clarinetOehler`, `oboe`) were generated from The Woodwind Fingering Guide's
charts by reading each fingering's key images, not its text — the images are
unambiguous where the text notation is not.

```bash
mkdir -p /tmp/wfg && cd /tmp/wfg
for f in cl_bas_1 cl_bas_2 cl_bas_3 cl_alt_4; do curl -sLO https://www.wfg.woodwind.org/clarinet/$f.html; done
python3 -I path/to/scripts/wfg/wfgparse.py cl_bas_1.html cl_bas_2.html cl_bas_3.html > basic.jsonl
python3 -I path/to/scripts/wfg/wfgparse.py cl_alt_4.html > alt.jsonl
python3 path/to/scripts/wfg/clgen.py boehm alt.jsonl basic.jsonl   # prints the TypeScript table
```

`clgen.py oehler` does the same for the `ocl_*` pages; `obgen.py alt.jsonl A6
basic.jsonl…` for the oboe (`ob_bas_*`, `ob_alt_3`). The first fingering a
basic chart gives for a note becomes its primary; notes above the basic charts
come from the alternate chart, at most a few per note, with a *Needs checking*
note on their primary.
