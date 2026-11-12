---
name: Shell Python can alter Replit configuration
description: A shell-based Python inspection may add an unrelated Python module to the workspace configuration.
---

After running Python utilities in the shell, check `.replit` for an unexpected `python-base` module entry. In this workspace it appeared after document-inspection commands and returned after a later Python command, despite the app being a Node project.

**Why:** The extra runtime module was unrelated to the app and changed a collaborator-visible configuration file.

**How to apply:** Prefer Node-based inspection when practical; if shell Python is used, inspect `.replit` afterward and remove only unrelated module additions through the validated configuration flow.
