export const getUniqArrayValues = (arr: string[] = []) => {
  const result: string[] = []

  for (let i = 0; i < arr.length; i++) {
    if (result.indexOf(arr[i]) === -1) {
      result.push(arr[i])
    }
  }

  return result
}

export const isObject = (object) => {
  return object !== null && typeof object === 'object'
}

export const isPrimitiveValue = (val: any) =>
  val === null || typeof val === 'boolean' || typeof val === 'string' || typeof val === 'number'

const addToTree = (
  {
    tree,
    branchKey,
    key,
    innerTree,
  }: {
    tree: Record<string | number, any>
    branchKey: string | number | undefined
    key: string | number
    innerTree: object | string | undefined
  }) => {
  if (branchKey) {
    if (tree[branchKey]) {
      tree[branchKey] = innerTree
    } else {
      tree[key] = innerTree
    }
  } else {
    if (innerTree && Object.keys(innerTree).length) {
      tree[key] = innerTree
    }
  }
}

export const checkObjectsDifference = (first: any, second: any) => {

  function check(ft: any, sd: any, branchKey?: string) {
    let tree: Record<string, any> = {}

    const checkKeys = (isObject(ft) || isObject(sd)) && !Array.isArray(sd)

    if (checkKeys) {
      const keys: string[] = getUniqArrayValues([
        ...(isObject(ft) ? Object.keys(ft) : []),
        ...(isObject(sd) ? Object.keys(sd) : []),
      ])

      keys.forEach((key: string) => {
        if (!isObject(sd) || !sd.hasOwnProperty(key)) {
          addToTree({
            branchKey,
            key,
            innerTree: {
              [key]: ft[key]
            },
            tree,
          })
          return
        }

        const ftValue = isObject(ft) && ft[key]
        const sdValue = isObject(sd) && sd[key]

        if (ftValue !== sdValue) {
          const innerTree = check(ftValue, sdValue, key)

          if (innerTree) {
            addToTree({
              branchKey,
              key,
              innerTree,
              tree,
            })
          }
        }
      })
    } else if (Array.isArray(ft) && Array.isArray(sd)) {

      if (ft.length !== sd.length) {
        addToTree({
          branchKey,
          key: 'array length not equal',
          innerTree: `${ft.length} !== ${sd.length}`,
          tree,
        })
      } else {
        ft.forEach((item, index) => {
          const { isDifferent, tree: checkTree } = checkObjectsDifference(item, sd[index])

          if (isDifferent) {
            addToTree({
              branchKey,
              key: index,
              innerTree: checkTree,
              tree,
            })
          }
        })
      }
    } else if (sd !== ft) {
      return ft
    }

    return Object.keys(tree).length > 0 ? tree : undefined
  }

  const tree = check(first, second)

  const isDifferent = isObject(tree) && tree && Object.keys(tree).length > 0 || (isPrimitiveValue(tree) && tree !== undefined)

  return {
    isDifferent,
    tree,
  }
}
