---
paths:
  - "src/app/**"
  - "src/features/card/**"
  - "src/features/drag/**"
  - "src/features/stack/**"
  - "src/features/toolbar/**"
---

# Card and stack positioning
- Any positioning code (drag, drop, load, resize, shuffle, compact, merge, future placement) keeps the stack drag handle on-canvas: the handle is drawn above a stack's bounding box, so nothing goes closer to the top edge than `STACK_HANDLE_TOP_CLEARANCE` (`features/stack/stack.ts`).
- Use or extend `clampCardPosition`/`computeGroupClampOffset`, never clamp against raw canvas bounds.
