import re

with open('/src/components/editor/PcbEditor.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Let's search using a regular expression to be robust to exact spaces
pattern = r'\}\s+else\s+\{\s+//\s+TO-92\s+\(D-shape\)\s+const\s+isHorizontal\s*=\s*rectW\s*>=\s*rectH;.*?\}\s*\}\s*\}\s*\}'

# Let's inspect what's there
match = re.search(r'// TO-92 \(D-shape\)', content)
if match:
    print("Found TO-92 comment!")
else:
    print("Not found TO-92 comment!")

# Let's write a precise replacement function
replacement = """} else {
                                      // TO-92 (D-shape)
                                      const pad0 = fp.pads[0];
                                      const pad1 = fp.pads[1];
                                      const pad2 = fp.pads[2];
                                      const avgOtherX = pad1 && pad2 ? (pad1.x + pad2.x) / 2 : nonPolarCx;
                                      const avgOtherY = pad1 && pad2 ? (pad1.y + pad2.y) / 2 : nonPolarCy;

                                      let pathD = "";
                                      let isVerticalFlat = Math.abs(avgOtherX - pad0.x) > Math.abs(avgOtherY - pad0.y);

                                      if (isVerticalFlat) {
                                        if (pad0.x < avgOtherX) {
                                          pathD = `M ${rectX + rectW} ${rectY + rectH} L ${rectX + rectW * 0.3} ${rectY + rectH} A ${rectW * 0.7} ${rectH / 2} 0 0 1 ${rectX + rectW * 0.3} ${rectY} L ${rectX + rectW} ${rectY} Z`;
                                        } else {
                                          pathD = `M ${rectX} ${rectY} L ${rectX + rectW * 0.7} ${rectY} A ${rectW * 0.7} ${rectH / 2} 0 0 1 ${rectX + rectW * 0.7} ${rectY + rectH} L ${rectX} ${rectY + rectH} Z`;
                                        }
                                      } else {
                                        if (pad0.y < avgOtherY) {
                                          pathD = `M ${rectX} ${rectY + rectH} L ${rectX} ${rectY + rectH * 0.3} A ${rectW / 2} ${rectH * 0.7} 0 0 1 ${rectX + rectW} ${rectY + rectH * 0.3} L ${rectX + rectW} ${rectY + rectH} Z`;
                                        } else {
                                          pathD = `M ${rectX + rectW} ${rectY} L ${rectX + rectW} ${rectY + rectH * 0.7} A ${rectW / 2} ${rectH * 0.7} 0 0 1 ${rectX} ${rectY + rectH * 0.7} L ${rectX} ${rectY} Z`;
                                        }
                                      }

                                      return (
                                        <g style={{ pointerEvents: "none" }}>
                                          <path
                                            d={pathD}
                                            fill="none"
                                            stroke={silkColor}
                                            strokeWidth={0.15}
                                          />
                                          {/* Pin 1 indicator - dot inside the envelope near the first pad */}
                                          <circle cx={isVerticalFlat ? (pad0.x < avgOtherX ? minPX + 0.3 : maxPX - 0.3) : nonPolarCx} cy={isVerticalFlat ? nonPolarCy : (pad0.y < avgOtherY ? minPY + 0.3 : maxPY - 0.3)} r={0.2} fill={silkColor} />
                                        </g>
                                      );
                                   }"""

# We can replace the exact lines by searching for the code range
start_marker = "                                   } else {\n                                      // TO-92 (D-shape)"
end_marker = "                                            <circle cx={nonPolarCx} cy={minPY + 0.3} r={0.2} fill={silkColor} />\n                                          </g>\n                                        );\n                                      }\n                                   }\n                                }"

# Let's try replacing with markers
content_replaced = content.replace(
    start_marker + content.split(start_marker)[1].split(end_marker)[0] + end_marker,
    start_marker.replace("                                   } else {\n                                      // TO-92 (D-shape)", replacement) + "\n                                }"
)

if len(content_replaced) != len(content):
    with open('/src/components/editor/PcbEditor.tsx', 'w', encoding='utf-8') as f:
        f.write(content_replaced)
    print("SUCCESS")
else:
    # Try normalizing newlines first
    content_norm = content.replace('\r\n', '\n')
    start_marker_norm = start_marker.replace('\r\n', '\n')
    end_marker_norm = end_marker.replace('\r\n', '\n')
    
    parts = content_norm.split(start_marker_norm)
    if len(parts) > 1:
        subparts = parts[1].split(end_marker_norm)
        if len(subparts) > 1:
            middle = subparts[0]
            to_replace = start_marker_norm + middle + end_marker_norm
            content_replaced_norm = content_norm.replace(to_replace, replacement + "\n                                }")
            with open('/src/components/editor/PcbEditor.tsx', 'w', encoding='utf-8') as f:
                f.write(content_replaced_norm)
            print("SUCCESS_NORM")
        else:
            print("END_MARKER_NOT_FOUND")
    else:
        print("START_MARKER_NOT_FOUND")
