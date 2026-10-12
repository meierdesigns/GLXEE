p = 'js/ui/home-station.js'
lines = open(p, encoding='utf-8').read().split('\n')
i = 4394  # 0-based index of line 4395
assert lines[i].rstrip() == '});', repr(lines[i])
indent = lines[i][:len(lines[i]) - len(lines[i].lstrip())]
lines[i] = indent + '}));'
open(p, 'w', encoding='utf-8').write('\n'.join(lines))
print('fixed ->', repr(lines[i]))
