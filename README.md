# icetea utils
Utilities for decentralized chatbot and others.

## How to use stateUtil

```
// id name deadline

const tasks = defineAutoList('tasks')
const taskId = tasks.add({ name: 'Run', deadline: block.timestamp })
console.log(tasks.has(taskId)) // true
const theTask = tasks.path(taskId)
console.log(theTask.exists()) // true

// delete
theTask.delete() // delete self
tasks.delete(taskId) // delete child
tasks.delete(taskId, taskId2) // 
tasks.delete(taskId, [sub1, sub2]) 

```
